"""
fuzzy_username.py — Fuzzy Username Search Connector
=====================================================

Takes a known username seed and:
  1. Generates up to 80 probable username variants using the mutation engine
  2. Actively probes each variant across high-value OSINT platforms concurrently
  3. Returns only confirmed hits as Findings, ranked by confidence

This surfaces shadow/alt accounts that direct exact-match enumeration
(UsernameEnumConnector) would completely miss.

Example:
  seed: johndoe
  discovers: johndoe92 (Reddit), john.doe (GitHub), j0hndoe (Instagram)
  → These are returned as findings with confidence scaled by:
      - How similar the variant is to the seed (mutation confidence)
      - How many platform-specific signals confirm the profile is real

Architecture:
  - Pulls from `username_mutator.generate_variants()` for the variant list
  - Uses a strict 2-level concurrency semaphore:
      outer: 6 variants probed simultaneously
      inner: 4 platforms per variant (24 concurrent requests max)
  - Applies rate limiting via the base TokenBucketLimiter
  - Short-circuits: stops probing low-confidence variants if quota fills early
"""

import asyncio
import logging
import re
import httpx

from app.connectors.base import BaseConnector, Finding, TokenBucketLimiter
from app.connectors.username_mutator import generate_variants
from app.models import IdentifierType

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Per-platform rate limiters — each platform is throttled independently so
# that probing GitHub does not consume tokens meant for Reddit, etc.
# This raises effective throughput from ~3 req/s to ~18 req/s (6 platforms x 3).
# ---------------------------------------------------------------------------

_PLATFORM_LIMITERS: dict[str, TokenBucketLimiter] = {}


def _get_platform_limiter(name: str) -> TokenBucketLimiter:
    """Return (or create) a per-platform token-bucket rate limiter."""
    if name not in _PLATFORM_LIMITERS:
        _PLATFORM_LIMITERS[name] = TokenBucketLimiter(rate=3.0, capacity=5.0)
    return _PLATFORM_LIMITERS[name]


# ---------------------------------------------------------------------------
# Platforms to check — curated for OSINT value, not quantity
# ---------------------------------------------------------------------------

PLATFORMS = [
    {
        "name": "GitHub",
        "url": "https://github.com/{username}",
        "profile_url": "https://github.com/{username}",
        "expect_status": 200,
        "not_found_strings": [],
        "confirm_strings": ["avatar", "repositories", "followers"],
    },
    {
        "name": "Reddit",
        "url": "https://www.reddit.com/user/{username}/about.json",
        "profile_url": "https://www.reddit.com/user/{username}",
        "expect_status": 200,
        "not_found_strings": ['"error": 404', '"error":404'],
        "confirm_strings": ["\"name\""],
    },
    {
        "name": "HackerNews",
        "url": "https://hacker-news.firebaseio.com/v0/user/{username}.json",
        "profile_url": "https://news.ycombinator.com/user?id={username}",
        "expect_status": 200,
        "not_found_strings": ["null"],
        "confirm_strings": ["\"id\"", "\"karma\""],
    },
    {
        "name": "Gravatar",
        "url": "https://en.gravatar.com/{username}.json",
        "profile_url": "https://en.gravatar.com/{username}",
        "expect_status": 200,
        "not_found_strings": ["user not found"],
        "confirm_strings": ["\"entry\""],
    },
    {
        "name": "GitLab",
        "url": "https://gitlab.com/{username}",
        "profile_url": "https://gitlab.com/{username}",
        "expect_status": 200,
        "not_found_strings": ["not found", "sign in"],
        "confirm_strings": ["user-header", "gl-avatar"],
    },
    {
        "name": "PyPI",
        "url": "https://pypi.org/user/{username}/",
        "profile_url": "https://pypi.org/user/{username}/",
        "expect_status": 200,
        "not_found_strings": ["not found"],
        "confirm_strings": ["pypi-username", "packages"],
    },
]

# Maximum variants to actively probe (cap to avoid rate-limit abuse)
MAX_VARIANTS_TO_PROBE = 30

# Minimum variant confidence to be worth probing.
# Variants below this threshold (e.g. generic seed numeric suffixes) are skipped.
MIN_PROBE_CONFIDENCE = 0.35

# Maximum confirmed findings to return per run (prevent result flooding)
MAX_FINDINGS = 15


class FuzzyUsernameConnector(BaseConnector):
    """
    Generates username mutations and actively probes platforms for each variant.
    Discovers alt/shadow accounts that exact-match enumeration cannot find.
    """
    name = "fuzzy_username"
    applies_to = (IdentifierType.username,)
    timeout_seconds = 12.0
    max_retries = 0
    # Longer cache TTL since these searches are expensive
    cache_ttl = 7200  # 2 hours

    async def run(
        self, identifier_value: str, metadata: dict | None = None
    ) -> list[Finding]:
        seed = identifier_value.lstrip("@").strip().lower()
        if not seed or len(seed) < 3:
            return []

        # Generate mutation variants ranked by confidence
        variants = generate_variants(seed, is_name=False, max_variants=MAX_VARIANTS_TO_PROBE)
        if not variants:
            return []

        logger.info(
            f"[{self.name}] Generated {len(variants)} variants for '{seed}'. "
            f"Probing top {min(len(variants), MAX_VARIANTS_TO_PROBE)}."
        )

        findings: list[Finding] = []
        findings_lock = asyncio.Lock()

        # Semaphores: control concurrent load
        # 12 variants simultaneously (up from 6) since we now have per-platform
        # rate limiters that independently throttle each destination.
        variant_sem = asyncio.Semaphore(12)
        # platform_sem removed — replaced by per-platform limiter below

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/json,*/*",
        }

        async def probe_platform(
            client: httpx.AsyncClient,
            variant: str,
            variant_confidence: float,
            variant_strategy: str,
            platform: dict,
        ) -> Finding | None:
            url = platform["url"].format(username=variant)
            try:
                # Each platform has its own 3 req/s budget — no cross-platform interference
                await _get_platform_limiter(platform["name"]).acquire()
                resp = await client.get(
                    url,
                    headers=headers,
                    timeout=self.timeout_seconds,
                    follow_redirects=True,
                )

                if resp.status_code != platform["expect_status"]:
                    return None

                body = resp.text
                body_lower = body.lower()

                # Check not-found markers
                for nf in platform["not_found_strings"]:
                    if nf.lower() in body_lower:
                        return None

                # Require at least one confirmation signal
                confirmed = any(
                    sig.lower() in body_lower
                    for sig in platform["confirm_strings"]
                )
                if not confirmed:
                    return None

                # Also require variant username appears somewhere in body (avoids redirect false positives)
                if variant.lower() not in body_lower:
                    return None

                profile_url = platform["profile_url"].format(username=variant)

                # Final confidence = variant confidence * 0.85 (platform confirmation)
                # Capped at 0.88 since fuzzy — we're not 100% sure it's the same person
                final_confidence = min(0.88, round(variant_confidence * 0.85, 3))

                return Finding(
                    connector_name=self.name,
                    result_type="fuzzy_profile_match",
                    result_value=f"{platform['name']} Fuzzy Match: {profile_url}",
                    confidence=final_confidence,
                    raw_payload={
                        "site": platform["name"].lower(),
                        "seed_username": seed,
                        "matched_variant": variant,
                        "variant_strategy": variant_strategy,
                        "variant_confidence": variant_confidence,
                        "profile_url": profile_url,
                        "verified": False,
                        "note": (
                            f"Fuzzy match — '{variant}' is a '{variant_strategy}' "
                            f"mutation of '{seed}'"
                        ),
                    },
                )

            except httpx.TimeoutException:
                logger.debug(f"[{self.name}] Timeout probing {url}")
                return None
            except httpx.RequestError as e:
                logger.warning(f"[{self.name}] Network error probing {url}: {e}")
                return None
            except Exception as e:
                logger.error(
                    f"[{self.name}] Unexpected error probing {url}: {e}", exc_info=True
                )
                return None

        async def probe_variant(client: httpx.AsyncClient, variant_obj) -> None:
            # Skip variants below the minimum confidence threshold.
            # This prunes generic-seed numeric suffixes (e.g. alex1992 at 0.30)
            # that are overwhelmingly noise.
            if variant_obj.confidence < MIN_PROBE_CONFIDENCE:
                return

            async with variant_sem:
                # Short-circuit: stop if findings quota is already full
                async with findings_lock:
                    if len(findings) >= MAX_FINDINGS:
                        return

                tasks = [
                    probe_platform(
                        client,
                        variant_obj.variant,
                        variant_obj.confidence,
                        variant_obj.strategy,
                        platform,
                    )
                    for platform in PLATFORMS
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                async with findings_lock:
                    for result in results:
                        if isinstance(result, Finding) and len(findings) < MAX_FINDINGS:
                            findings.append(result)

        async with httpx.AsyncClient() as client:
            await asyncio.gather(
                *(probe_variant(client, v) for v in variants[:MAX_VARIANTS_TO_PROBE])
            )

        # Sort by confidence descending
        findings.sort(key=lambda f: f.confidence, reverse=True)

        logger.info(
            f"[{self.name}] Found {len(findings)} fuzzy matches for '{seed}'."
        )
        return findings

import asyncio
import logging
import httpx
import re
import urllib.parse
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)


CRAWLER_IG_HEADERS = {
    "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

CRAWLER_LI_HEADERS = {
    "User-Agent": "Twitterbot/1.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def generate_username_variants(username: str) -> list[str]:
    """
    Generate realistic candidate usernames.
    For multi-word names (e.g. 'Satya Nadella'), generates concatenated/dotted combinations.
    For single usernames, returns the handle itself and minor numerical variants.
    """
    clean = username.strip()
    if not clean or len(clean) < 2:
        return [clean]

    has_space = " " in clean

    if has_space:
        words = [w.strip() for w in clean.split() if w.strip()]
        if len(words) >= 2:
            first = words[0].lower()
            last = words[-1].lower()
            combos = [
                f"{first}{last}",           # satyanadella
                f"{first}.{last}",          # satya.nadella
                f"{first}_{last}",          # satya_nadella
                f"{first}-{last}",          # satya-nadella
                f"{first[0]}{last}",         # snadella
                f"{first}{last[0]}",         # satyan
                f"iam{first}{last}",         # iamsatyanadella
                f"real{first}{last}",        # realsatyanadella
            ]
            return combos
    else:
        variants = [clean.lower()]
        no_trailing_nums = re.sub(r'\d+$', '', clean)
        if no_trailing_nums and no_trailing_nums.lower() != clean.lower() and len(no_trailing_nums) >= 2:
            variants.append(no_trailing_nums.lower())
        return variants

    return [clean.lower()]


def is_profile_match(target: str, title: str, handle: str) -> bool:
    """Verify that candidate profile actually matches queried name/handle."""
    from rapidfuzz import fuzz

    target_clean = target.strip().lower()
    if not target_clean:
        return False
    title_lower = title.lower()
    handle_lower = handle.lower()

    person_name = title.split(" - ")[0].split(" | ")[0].split(" • ")[0].split("(@")[0].strip().lower()

    if " " in target_clean:
        if person_name:
            sim_person = max(
                fuzz.token_set_ratio(target_clean, person_name),
                fuzz.token_sort_ratio(target_clean, person_name),
                fuzz.ratio(target_clean, person_name),
            )
            if sim_person >= 80:
                return True

        words = [w for w in target_clean.split() if len(w) >= 2]
        if all(w in title_lower for w in words) and (
            handle_lower == "".join(words)
            or handle_lower == ".".join(words)
            or handle_lower == "_".join(words)
            or handle_lower == "-".join(words)
        ):
            return True

        return False
    else:
        if target_clean == handle_lower:
            return True
        if target_clean in handle_lower:
            return True
        return False


async def _direct_check_instagram(client: httpx.AsyncClient, handle: str) -> dict | None:
    clean = handle.strip().lstrip("@")
    if not clean or len(clean) < 2 or " " in clean:
        return None
    url = f"https://www.instagram.com/{clean}/"
    try:
        r = await client.get(url, headers=CRAWLER_IG_HEADERS, follow_redirects=True, timeout=4.0)
        if r.status_code == 200:
            html = r.text
            og_title_m = (
                re.search(r'property="og:title"\s+content="([^"]*)"', html, re.IGNORECASE)
                or re.search(r'og:title[^>]*content="([^"]*)"', html, re.IGNORECASE)
            )
            if og_title_m:
                title = og_title_m.group(1)
                title_lower = title.lower()
                if "instagram" in title_lower and clean.lower() in title_lower:
                    followers = "unknown"
                    desc_m = (
                        re.search(r'property="og:description"\s+content="([^"]*)"', html, re.IGNORECASE)
                        or re.search(r'og:description[^>]*content="([^"]*)"', html, re.IGNORECASE)
                    )
                    if desc_m:
                        desc = desc_m.group(1)
                        f_m = re.search(r'(\d[\d,]*[KMkm]?)\s*[Ff]ollower', desc)
                        if f_m:
                            followers = f_m.group(1).replace(',', '')
                    return {
                        "username": clean,
                        "profile_url": url,
                        "title": title,
                        "followers": followers,
                    }
    except Exception:
        pass
    return None


async def _direct_check_linkedin(client: httpx.AsyncClient, handle: str) -> dict | None:
    clean = handle.strip().lstrip("@")
    if not clean or len(clean) < 2 or " " in clean:
        return None
    url = f"https://www.linkedin.com/in/{clean}/"
    try:
        r = await client.get(url, headers=CRAWLER_LI_HEADERS, follow_redirects=True, timeout=4.0)
        if r.status_code == 200:
            title_m = re.search(r'<title>([^<]+)</title>', r.text, re.IGNORECASE)
            title = title_m.group(1) if title_m else ""
            title_lower = title.lower()
            if "linkedin" in title_lower and "profile not found" not in title_lower and "404" not in title_lower:
                return {
                    "username": clean,
                    "profile_url": url,
                    "title": title,
                }
    except Exception:
        pass
    return None


class SocialProfilerConnector(BaseConnector):
    name = "social_profiler"
    applies_to = (IdentifierType.username, IdentifierType.name)
    timeout_seconds = 10.0
    max_retries = 1

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        val = identifier_value.strip()
        findings = []

        # 1. Reddit Lookup
        findings.extend(await self._check_reddit(val))

        # 2. Instagram Lookup
        findings.extend(await self._check_instagram(val))

        # 3. LinkedIn Lookup
        findings.extend(await self._check_linkedin(val))

        return findings

    async def _check_reddit(self, val: str) -> list[Finding]:
        clean_val = re.sub(r'[^a-zA-Z0-9_\-\s]', '', val).strip()
        if not clean_val:
            return []
        has_space = " " in clean_val
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

        # Generate variants for more flexible matching
        variants = generate_username_variants(clean_val)

        # Try direct JSON lookup first for each variant (if no spaces in original)
        if not has_space:
            for variant in variants:
                # Skip variants with spaces for direct lookup (they won't work as usernames)
                if " " in variant:
                    continue
                try:
                    async with httpx.AsyncClient(timeout=4.0, headers=headers) as client:
                        r = await client.get(f"https://www.reddit.com/user/{variant}/about.json")
                        if r.status_code == 200:
                            data = r.json().get("data", {})
                            if data:
                                karma = data.get("total_karma", 0)
                                created = data.get("created_utc", 0)
                                return [
                                    Finding(
                                        connector_name=self.name,
                                        result_type="reddit_profile",
                                        result_value=f"Reddit profile: u/{variant} | Karma: {karma}",
                                        confidence=0.95,
                                        raw_payload={
                                            "username": variant,
                                            "karma": karma,
                                            "created_utc": created,
                                            "profile_url": f"https://www.reddit.com/user/{variant}"
                                        }
                                    )
                                ]
                except Exception as e:

                    logger.error(f"Unexpected error: {e}", exc_info=True)
                    continue  # Try next variant

        # Fallback/Name search via Yahoo Search - use flexible matching
        try:
            # Always search Yahoo with exact quotes for precise matching on the full name in the title/content
            query = f'site:reddit.com/user "{clean_val}"'

            async with httpx.AsyncClient(timeout=4.0, headers=headers) as client:
                r = await client.get(f"https://search.yahoo.com/search?q={urllib.parse.quote(query)}")
                if r.status_code == 200:
                    matches = re.findall(r'RU=(https?%3a%2f%2f[a-z\.]*reddit\.com%2fuser%2f[a-zA-Z0-9\-%_]+)', r.text, re.IGNORECASE)
                    
                    from rapidfuzz import fuzz
                    for m in matches:
                        url = urllib.parse.unquote(m)
                        uname_match = re.search(r'/user/([a-zA-Z0-9\-%_]+)', url)
                        if uname_match:
                            username = uname_match.group(1)
                            is_valid = False
                            
                            uname_clean = re.sub(r'[\d\-]', '', username).lower()
                            val_clean = clean_val.lower().replace(" ", "")
                            if any(v.lower() == username.lower() for v in variants if " " not in v) or fuzz.partial_ratio(val_clean, uname_clean) > 85:
                                is_valid = True
                            else:
                                # 2. Check title tag for original name
                                try:
                                    async with httpx.AsyncClient(timeout=5.0, headers=headers, follow_redirects=True) as client2:
                                        r2 = await client2.get(url)
                                        if r2.status_code == 200:
                                            title_match = re.search(r'<title>([^<]+)</title>', r2.text, re.IGNORECASE)
                                            if title_match:
                                                title = title_match.group(1).lower()
                                                if fuzz.partial_ratio(clean_val.lower(), title) > 65 or fuzz.WRatio(clean_val.lower(), title) > 65:
                                                    is_valid = True
                                except Exception as e:
                                    logger.debug(f"Reddit profile fetch failed: {e}")
                                                
                            if is_valid:
                                return [
                                    Finding(
                                        connector_name=self.name,
                                        result_type="reddit_profile",
                                        result_value=f"Reddit profile matching \"{clean_val}\" (u/{username})",
                                        confidence=0.85,
                                        raw_payload={
                                            "username": username,
                                            "profile_url": url
                                        }
                                    )
                                ]
        except Exception as e:

            logger.warning(f"Silenced exception: {e}", exc_info=True)
        return []

    async def _check_instagram(self, val: str) -> list[Finding]:
        clean_val = val.strip().lstrip("@")
        if not clean_val or len(clean_val) < 2:
            return []
        has_space = " " in clean_val
        variants = generate_username_variants(clean_val)
        candidates_to_try = [clean_val] if not has_space else [v for v in variants if " " not in v][:4]

        async with httpx.AsyncClient() as client:
            tasks = [_direct_check_instagram(client, c) for c in candidates_to_try]
            results = await asyncio.gather(*tasks)
            for res in results:
                if res and is_profile_match(clean_val, res["title"], res["username"]):
                    followers_text = f" | Followers: {res['followers']}" if res.get('followers') != 'unknown' else ""
                    return [
                        Finding(
                            connector_name=self.name,
                            result_type="instagram_profile",
                            result_value=f"Instagram profile: @{res['username']}{followers_text}",
                            confidence=0.95 if not has_space else 0.85,
                            raw_payload={
                                "username": res["username"],
                                "followers": res.get("followers", "unknown"),
                                "profile_url": res["profile_url"],
                                "title": res.get("title", ""),
                            }
                        )
                    ]

            # Fallback search via Yahoo
            try:
                q = f"site:instagram.com {clean_val}"
                r = await client.get("https://search.yahoo.com/search", params={"p": q}, headers=BROWSER_HEADERS, follow_redirects=True, timeout=5.0)
                if r.status_code == 200:
                    matches = re.findall(r'RU=([^/"]+)/RK=', r.text)
                    skip_routes = {'p', 'explore', 'developer', 'about', 'reel', 'tv', 'accounts', 'stories', 'reels', 'login', 'directory'}
                    candidate_handles = []
                    for m in matches:
                        u = urllib.parse.unquote(m)
                        if "instagram.com/" in u:
                            handle = u.split("instagram.com/")[-1].strip("/").split("?")[0].split("/")[0]
                            if handle and handle.lower() not in skip_routes and len(handle) >= 2:
                                if handle not in candidate_handles:
                                    candidate_handles.append(handle)

                    for handle in candidate_handles[:4]:
                        res = await _direct_check_instagram(client, handle)
                        if res and is_profile_match(clean_val, res["title"], res["username"]):
                            followers_text = f" | Followers: {res['followers']}" if res.get('followers') != 'unknown' else ""
                            return [
                                Finding(
                                    connector_name=self.name,
                                    result_type="instagram_profile",
                                    result_value=f"Instagram profile: @{res['username']}{followers_text}",
                                    confidence=0.85,
                                    raw_payload={
                                        "username": res["username"],
                                        "followers": res.get("followers", "unknown"),
                                        "profile_url": res["profile_url"],
                                        "title": res.get("title", ""),
                                    }
                                )
                            ]
            except Exception as e:
                logger.warning(f"Instagram search exception: {e}", exc_info=True)

        return []

    async def _check_linkedin(self, val: str) -> list[Finding]:
        clean_val = val.strip().lstrip("@")
        if not clean_val or len(clean_val) < 2:
            return []
        has_space = " " in clean_val
        variants = generate_username_variants(clean_val)
        candidates_to_try = [clean_val] if not has_space else [v for v in variants if " " not in v][:4]

        async with httpx.AsyncClient() as client:
            tasks = [_direct_check_linkedin(client, c) for c in candidates_to_try]
            results = await asyncio.gather(*tasks)
            for res in results:
                if res and is_profile_match(clean_val, res["title"], res["username"]):
                    return [
                        Finding(
                            connector_name=self.name,
                            result_type="linkedin_profile",
                            result_value=f"LinkedIn profile: {res['title']}",
                            confidence=0.95 if not has_space else 0.85,
                            raw_payload={
                                "username": res["username"],
                                "profile_url": res["profile_url"],
                                "title": res["title"],
                            }
                        )
                    ]

            # Fallback search via Yahoo (clean syntax: site:linkedin.com/in {name})
            try:
                q = f"site:linkedin.com/in {clean_val}"
                r = await client.get("https://search.yahoo.com/search", params={"p": q}, headers=BROWSER_HEADERS, follow_redirects=True, timeout=5.0)
                if r.status_code == 200:
                    matches = re.findall(r'RU=([^/"]+)/RK=', r.text)
                    candidate_handles = []
                    for m in matches:
                        u = urllib.parse.unquote(m)
                        if "linkedin.com/in/" in u:
                            handle = u.split("linkedin.com/in/")[-1].strip("/").split("?")[0].split("/")[0]
                            if handle and handle.lower() not in ("in", "dir", "login") and len(handle) >= 2:
                                if handle not in candidate_handles:
                                    candidate_handles.append(handle)

                    for handle in candidate_handles[:4]:
                        res = await _direct_check_linkedin(client, handle)
                        if res and is_profile_match(clean_val, res["title"], res["username"]):
                            return [
                                Finding(
                                    connector_name=self.name,
                                    result_type="linkedin_profile",
                                    result_value=f"LinkedIn profile: {res['title']}",
                                    confidence=0.85,
                                    raw_payload={
                                        "username": res["username"],
                                        "profile_url": res["profile_url"],
                                        "title": res["title"],
                                    }
                                )
                            ]
            except Exception as e:
                logger.warning(f"LinkedIn search exception: {e}", exc_info=True)

        return []
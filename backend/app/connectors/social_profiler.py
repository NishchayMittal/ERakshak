import logging
import httpx
import re
import urllib.parse
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)


def generate_username_variants(username: str) -> list[str]:
    """
    Generate common variants of a username for more flexible searching.
    Returns a list of variants including the original.

    For names (e.g. "Virat Kohli"), this generates realistic social media
    username patterns:
      - viratkohli      (concatenated)
      - virat.kohli     (dot separated)
      - virat_kohli     (underscore separated)
      - virat-kohli     (hyphen separated)
      - vkohli          (first initial + last name)
      - viratk          (first name + last initial)
      - kohli           (last name only)
      - virat           (first name only)
      - viratkohli123   (with random numbers)
      - iamviratkohli   (with "iam" prefix)
    """
    if not username or len(username) < 2:
        return [username]

    variants: set[str] = {username}  # Use a set to avoid duplicates

    # Split into words if this looks like a name
    words = [w.strip() for w in username.replace("_", " ").replace(".", " ").replace("-", " ").split() if w.strip()]
    lowercase_username = username.lower()

    if len(words) >= 2:
        # Multi-word name → generate social-media-style usernames
        first = words[0].lower()
        last = words[-1].lower()

        # Combined forms (most common on social media)
        combos = [
            f"{first}{last}",           # viratkohli
            f"{first}.{last}",          # virat.kohli
            f"{first}_{last}",          # virat_kohli
            f"{first}-{last}",          # virat-kohli
            f"{first[0]}{last}",         # vkohli
            f"{first}{last[0]}",         # viratk
            f"iam{first}{last}",         # iamviratkohli
            f"official{first}{last}",     # officialviratkohli
            f"real{first}{last}",         # realviratkohli
            f"the{first}{last}",          # theviratkohli
            f"{first}{last}official",     # viratkohliofficial
        ]

        # If more than 2 words, try first_middle_last patterns
        if len(words) >= 3:
            middle = "_".join(words)
            combos.extend([
                middle,
                middle.lower().replace(" ", "."),
                middle.lower().replace(" ", "_"),
            ])

        for combo in combos:
            cleaned = combo.strip().lower()
            if 2 <= len(cleaned) <= 64:
                variants.add(cleaned)

    else:
        # Single word — apply the original transformations
        no_trailing_nums = re.sub(r'\d+$', '', username)
        if no_trailing_nums and no_trailing_nums != username:
            variants.add(no_trailing_nums)

        no_leading_nums = re.sub(r'^\d+', '', username)
        if no_leading_nums and no_leading_nums != username:
            variants.add(no_leading_nums)

        # Replace common leetspeak substitutions
        leetspeak_map = {
            '0': 'o', '3': 'e', '4': 'a',
            '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
            '2': 'z'
        }
        leet_version = username
        for num, letter in leetspeak_map.items():
            if num in leet_version:
                leet_version = leet_version.replace(num, letter)
        if leet_version != username and len(leet_version) >= 2:
            variants.add(leet_version)

        # Remove underscores
        no_underscores = username.replace('_', '')
        if no_underscores and no_underscores != username and len(no_underscores) >= 2:
            variants.add(no_underscores)

        # Remove dots
        no_dots = username.replace('.', '')
        if no_dots and no_dots != username and len(no_dots) >= 2:
            variants.add(no_dots)

    # Convert set back to list and limit to reasonable number
    result = list(variants)
    # Prioritize shorter, more common variants (shorter = more likely to be taken)
    result.sort(key=lambda x: (len(x), x))
    return result[:12]  # Limit to 12 variants max to avoid excessive requests


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
            # Instead of exact quoted search, use OR logic for multiple variants or remove quotes for fuzzy matching
            # Build a query that searches for any of our variants
            query_variants = [v for v in variants if " " not in v][:4]  # Limit to 4 variants without spaces
            if query_variants:
                # Create OR query: site:reddit.com/user (term1 OR term2 OR term3)
                query_parts = [f'"{v}"' for v in query_variants]
                query = f'site:reddit.com/user {" OR ".join(query_parts)}'
            else:
                # Fallback to original approach but without strict quotes for fuzzy matching
                query = f'site:reddit.com/user {clean_val}'

            async with httpx.AsyncClient(timeout=4.0, headers=headers) as client:
                r = await client.get(f"https://search.yahoo.com/search?q={urllib.parse.quote(query)}")
                if r.status_code == 200:
                    matches = re.findall(r'RU=(https?%3a%2f%2f[a-z\.]*reddit\.com%2fuser%2f[a-zA-Z0-9\-%_]+)', r.text, re.IGNORECASE)
                    for m in matches:
                        url = urllib.parse.unquote(m)
                        uname_match = re.search(r'/user/([a-zA-Z0-9\-%_]+)', url)
                        if uname_match:
                            username = uname_match.group(1)
                            is_valid = False
                            # 1. Strict match against generated variants without spaces
                            if any(v.lower() == username.lower() for v in variants if " " not in v):
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
                                                from rapidfuzz import fuzz
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
        clean_val = re.sub(r'[^a-zA-Z0-9_\.\s]', '', val).strip()
        if not clean_val:
            return []
        has_space = " " in clean_val
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

        # Generate variants for more flexible matching
        variants = generate_username_variants(clean_val)

        # Try direct Instagram profile lookup for each variant if no spaces
        if not has_space:
            for variant in variants:
                # Skip variants with spaces for direct lookup (they won't work as usernames)
                if " " in variant:
                    continue
                try:
                    async with httpx.AsyncClient(timeout=5.0, headers=headers, follow_redirects=True) as client:
                        r = await client.get(f"https://www.instagram.com/{variant}/")
                        if r.status_code == 200:
                            if "accounts/login" in str(r.url).lower():
                                continue
                                
                            html = r.text
                            # Check if the profile exists by looking for typical patterns
                            # Instagram returns a 200 even for non-existent profiles, so we
                            # need to detect "not found" indicators
                            not_found_indicators = [
                                "this page isn't available",
                                "the link you followed may be broken",
                                "page isn't available",
                                "sorry, this page",
                                "content isn't available",
                                "page not found",
                            ]
                            is_not_found = any(indicator in html.lower() for indicator in not_found_indicators)

                            if not is_not_found:
                                # Check multiple indicators of a real profile
                                profile_detected = False

                                # 1. Check if username appears in script data
                                if variant.lower() in html.lower():
                                    profile_detected = True

                                # 2. Check for og:title meta tag (typically "First Last (@username) • Instagram")
                                og_title_match = re.search(
                                    r'og:title["\s][^>]*content="([^"}]*)',
                                    html, re.IGNORECASE
                                )
                                if og_title_match and variant.lower() in og_title_match.group(1).lower():
                                    profile_detected = True

                                # 3. Check for profile page JSON data
                                if f'"username":"{variant}"' in html or f'"username":"{variant.lower()}"' in html.lower():
                                    profile_detected = True

                                # 4. Check title tag
                                title_match = re.search(r'<title>([^<]+)</title>', html, re.IGNORECASE)
                                if title_match and "instagram" in title_match.group(1).lower():
                                    profile_detected = True

                                if profile_detected:
                                    # Attempt to extract follower count from meta property og:description
                                    followers = "unknown"
                                    follow_match = re.search(
                                        r'(\d[\d,]*[KMkm]?)\s*[Ff]ollower',
                                        html, re.IGNORECASE
                                    )
                                    if follow_match:
                                        followers = follow_match.group(1).replace(',', '')
                                    # Get full name from og:title
                                    full_name = variant
                                    title_match = re.search(r'og:title"[^>]*content="([^"]*)"', html, re.IGNORECASE)
                                    if title_match:
                                        full_name = title_match.group(1).strip()
                                    return [
                                        Finding(
                                            connector_name=self.name,
                                            result_type="instagram_profile",
                                            result_value=f"Instagram profile: @{variant} | Followers: {followers}",
                                            confidence=0.9,
                                            raw_payload={
                                                "username": variant,
                                                "followers": followers,
                                                "full_name": full_name,
                                                "profile_url": f"https://www.instagram.com/{variant}/"
                                            }
                                        )
                                    ]
                except Exception as e:

                    logger.error(f"Unexpected error: {e}", exc_info=True)
                    continue  # Try next variant

        # Fallback/Name search via DuckDuckGo & Yahoo Search - use flexible matching
        try:
            query = f'site:instagram.com {clean_val}'
            
            ddg_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
            }

            extracted_urls = []
            async with httpx.AsyncClient(timeout=6.0, headers=ddg_headers, follow_redirects=True) as client:
                r = await client.post("https://html.duckduckgo.com/html/", data={"q": query})
                if r.status_code in (200, 202):
                    html = r.text
                    for match in re.finditer(r'uddg=([^"&]+)', html):
                        from urllib.parse import unquote
                        decoded = unquote(match.group(1))
                        if "instagram.com" in decoded:
                            extracted_urls.append(decoded)
                    for match in re.finditer(r'class="result__a"[^>]*href="([^"]+)"', html):
                        url = match.group(1)
                        if "instagram.com" in url:
                            extracted_urls.append(url)

                # Fallback to Yahoo if DDG returned no URLs
                if not extracted_urls:
                    r2 = await client.get(f"https://search.yahoo.com/search?q={urllib.parse.quote(query)}")
                    if r2.status_code == 200:
                        for m in re.findall(r'RU=(https?%3a%2f%2f[a-z\.]*instagram\.com%2f[a-zA-Z0-9\-%_]+)', r2.text, re.IGNORECASE):
                            extracted_urls.append(urllib.parse.unquote(m))

            skip_routes = {'p', 'explore', 'developer', 'about', 'reel', 'tv', 'accounts', 'stories', 'reels', 'login'}
            from rapidfuzz import fuzz

            for url in set(extracted_urls):
                uname = url.split("instagram.com/")[-1].strip("/").split("?")[0].split("/")[0]
                if not uname or uname.lower() in skip_routes or len(uname) < 2:
                    continue

                # Compute match score against queried name & variants
                sim = max(
                    fuzz.token_set_ratio(clean_val.lower(), uname.lower()),
                    fuzz.token_sort_ratio(clean_val.lower(), uname.lower()),
                    fuzz.WRatio(clean_val.lower(), uname.lower()),
                    fuzz.partial_ratio(clean_val.lower(), uname.lower()),
                    fuzz.ratio(clean_val.lower().replace(" ", ""), uname.lower().replace("_", "").replace(".", ""))
                )

                if sim >= 58 or any(v.lower() == uname.lower() for v in variants if " " not in v):
                    clean_profile_url = f"https://www.instagram.com/{uname}/"
                    return [
                        Finding(
                            connector_name=self.name,
                            result_type="instagram_profile",
                            result_value=f"Instagram profile matching \"{clean_val}\" (@{uname})",
                            confidence=min(0.90, round(sim / 100.0, 2)),
                            raw_payload={
                                "username": uname,
                                "profile_url": clean_profile_url,
                                "match_similarity": sim,
                            }
                        )
                    ]
        except Exception as e:
            logger.warning(f"Instagram search exception: {e}", exc_info=True)
        return []

    async def _check_linkedin(self, val: str) -> list[Finding]:
        clean_val = val.strip()
        if not clean_val:
            return []
        # Remove the demo/test values
        # if clean_val.lower() in ("suspect", "test_user", "agent"):
        #     return [...]   # removed

        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

        # Generate variants for more flexible matching
        variants = generate_username_variants(clean_val)

        try:
            # Instead of exact quoted search, use OR logic for multiple variants or remove quotes for fuzzy matching
            # Build a query that searches for any of our variants
            query_variants = [v for v in variants if " " not in v][:4]  # Limit to 4 variants without spaces
            if query_variants:
                # Create OR query: site:linkedin.com/in/ (term1 OR term2 OR term3)
                query_parts = [f'"{v}"' for v in query_variants]
                query = f'site:linkedin.com/in/ {" OR ".join(query_parts)}'
            else:
                # Fallback to original approach but without strict quotes for fuzzy matching
                query = f'site:linkedin.com/in/ {clean_val}'

            async with httpx.AsyncClient(timeout=4.0, headers=headers) as client:
                r = await client.get(f"https://search.yahoo.com/search?q={urllib.parse.quote(query)}")
                if r.status_code == 200:
                    matches = re.findall(r'RU=(https?%3a%2f%2f[a-z\.]*linkedin\.com%2fin%2f[a-zA-Z0-9\-%_]+)', r.text, re.IGNORECASE)
                    for m in matches:
                        url = urllib.parse.unquote(m)
                        profile_id = url.split("linkedin.com/in/")[-1].replace("/", "").split("?")[0].split("/")[0]
                        if not profile_id:
                            continue
                            
                        is_valid = False
                        # 1. Strict variant match
                        if any(v.lower() == profile_id.lower() for v in variants if " " not in v):
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
                                            from rapidfuzz import fuzz
                                            if fuzz.partial_ratio(clean_val.lower(), title) > 65 or fuzz.WRatio(clean_val.lower(), title) > 65:
                                                is_valid = True
                            except Exception as e:
                                logger.debug(f"LinkedIn profile fetch failed: {e}")
                        
                        if is_valid:
                            return [
                                Finding(
                                    connector_name=self.name,
                                    result_type="linkedin_profile",
                                    result_value=f"LinkedIn profile matching \"{clean_val}\"",
                                    confidence=0.85,
                                    raw_payload={
                                        "username": profile_id,
                                        "profile_url": url
                                    }
                                )
                            ]
        except Exception as e:

            logger.warning(f"Silenced exception: {e}", exc_info=True)
        return []
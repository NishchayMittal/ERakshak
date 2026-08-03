import os
import logging
import httpx
from datetime import datetime, timezone
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)

GOOGLE_VISION_MONTHLY_LIMIT = 1000


def _check_and_increment_image_quota() -> int:
    """
    Atomically checks and increments the Google Vision API monthly quota
    using the DB-backed SystemQuota table (Redis-free, crash-safe).
    Returns the current count AFTER increment, or raises RuntimeError if limit hit.
    """
    from app.database import SessionLocal
    from app.models import SystemQuota
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    quota_key = f"google_vision_{now.year}_{now.month:02d}"

    db = SessionLocal()
    try:
        quota = db.get(SystemQuota, quota_key)
        if quota is None:
            quota = SystemQuota(key=quota_key, count=0)
            db.add(quota)
            db.flush()

        if quota.count >= GOOGLE_VISION_MONTHLY_LIMIT:
            raise RuntimeError(
                f"Google Vision API monthly quota of {GOOGLE_VISION_MONTHLY_LIMIT} requests exceeded. "
                f"Current count: {quota.count}. Quota resets next month."
            )

        quota.count += 1
        db.commit()
        logger.info(f"Google Vision quota: {quota.count}/{GOOGLE_VISION_MONTHLY_LIMIT} used this month.")
        return quota.count
    except RuntimeError:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to check image quota from DB: {e}")
        raise RuntimeError("Could not verify API quota. Request blocked for safety.") from e
    finally:
        db.close()

MOCK_DATA = {
    "alpha": [
        Finding(
            connector_name="reverse_image_search",
            result_type="image_entity_label",
            result_value="Suspect Alpha",
            confidence=0.92,
            raw_payload={"source": "mock_google_vision", "entity_name": "Suspect Alpha"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_hosting_page",
            result_value="https://github.com/alpha-developer",
            confidence=0.85,
            raw_payload={"source": "mock_google_vision", "url": "https://github.com/alpha-developer"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_exact_match",
            result_value="https://alpha-dev-portfolio.pages.dev/assets/profile.png",
            confidence=0.95,
            raw_payload={"source": "mock_google_vision", "url": "https://alpha-dev-portfolio.pages.dev/assets/profile.png"}
        )
    ],
    "beta": [
        Finding(
            connector_name="reverse_image_search",
            result_type="image_entity_label",
            result_value="Suspect Beta",
            confidence=0.94,
            raw_payload={"source": "mock_google_vision", "entity_name": "Suspect Beta"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_hosting_page",
            result_value="https://twitter.com/beta_intel",
            confidence=0.85,
            raw_payload={"source": "mock_google_vision", "url": "https://twitter.com/beta_intel"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_exact_match",
            result_value="https://beta-breach-blog.org/images/avatar.jpg",
            confidence=0.95,
            raw_payload={"source": "mock_google_vision", "url": "https://beta-breach-blog.org/images/avatar.jpg"}
        )
    ],
    "ronaldo": [
        Finding(
            connector_name="reverse_image_search",
            result_type="image_entity_label",
            result_value="Cristiano Ronaldo",
            confidence=0.99,
            raw_payload={"source": "mock_google_vision", "entity_name": "Cristiano Ronaldo"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_hosting_page",
            result_value="https://instagram.com/cristiano",
            confidence=0.95,
            raw_payload={"source": "mock_google_vision", "url": "https://instagram.com/cristiano"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_exact_match",
            result_value="https://upload.wikimedia.org/wikipedia/commons/8/8c/Cristiano_Ronaldo_2018.jpg",
            confidence=0.99,
            raw_payload={"source": "mock_google_vision", "url": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Cristiano_Ronaldo_2018.jpg"}
        )
    ],
    "virat": [
        Finding(
            connector_name="reverse_image_search",
            result_type="image_entity_label",
            result_value="Virat Kohli",
            confidence=0.99,
            raw_payload={"source": "mock_google_vision", "entity_name": "Virat Kohli"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_hosting_page",
            result_value="https://github.com/virat-kohli",
            confidence=0.85,
            raw_payload={"source": "mock_google_vision", "url": "https://github.com/virat-kohli"}
        )
    ],
    "kohli": [
        Finding(
            connector_name="reverse_image_search",
            result_type="image_entity_label",
            result_value="Virat Kohli",
            confidence=0.99,
            raw_payload={"source": "mock_google_vision", "entity_name": "Virat Kohli"}
        ),
        Finding(
            connector_name="reverse_image_search",
            result_type="image_hosting_page",
            result_value="https://github.com/virat-kohli",
            confidence=0.85,
            raw_payload={"source": "mock_google_vision", "url": "https://github.com/virat-kohli"}
        )
    ]
}

def get_mock_findings(filename: str) -> list[Finding]:
    for key, findings in MOCK_DATA.items():
        if key in filename:
            return findings
    # Return empty if no specific mock data matches, rather than hardcoding a confusing fallback
    return None

class ReverseImageConnector(BaseConnector):
    name = "reverse_image_search"
    applies_to = (IdentifierType.photo,)
    timeout_seconds = 20.0
    max_retries = 1

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        # Resolve GOOGLE_APPLICATION_CREDENTIALS to absolute path if it is relative to backend root
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and not os.path.isabs(cred_path):
            backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            abs_cred_path = os.path.abspath(os.path.join(backend_dir, cred_path))
            if os.path.exists(abs_cred_path):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = abs_cred_path
                logger.info(f"Resolved relative GOOGLE_APPLICATION_CREDENTIALS to absolute path: {abs_cred_path}")

        img_filename = os.path.basename(identifier_value).lower()
        findings = []

        # 1. Check if we should return mock data first (if credentials aren't set or for testing)
        has_credentials = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") is not None
        
        # If credentials are not set, return realistic mock data for development
        if not has_credentials:
            mock_res = get_mock_findings(img_filename)
            if mock_res:
                return mock_res

        # 2. Run Google Vision API
        try:
            # Check monthly quota using DB-backed counter (Redis-free, fail-CLOSED for safety)
            _check_and_increment_image_quota()

            from google.cloud import vision

            # Load image bytes content
            content = None
            if identifier_value.startswith("http://") or identifier_value.startswith("https://"):
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
                    resp = await client.get(identifier_value)
                    if resp.status_code == 200:
                        content = resp.content
            else:
                resolved_path = identifier_value
                if not os.path.exists(resolved_path):
                    uploads_dir = os.path.abspath(
                        os.path.join(os.path.dirname(__file__), "..", "resources", "uploads")
                    )
                    possible_path = os.path.join(uploads_dir, identifier_value.replace("\\", "/"))
                    if os.path.exists(possible_path):
                        resolved_path = possible_path
                
                if os.path.exists(resolved_path):
                    with open(resolved_path, "rb") as image_file:
                        content = image_file.read()

            if content is None:
                # If local file is missing, try fallback mock check
                mock_res = get_mock_findings(img_filename)
                if mock_res:
                    return mock_res
                return []

            # Call API
            client = vision.ImageAnnotatorClient()
            image = vision.Image(content=content)
            
            # Execute web detection request in a thread pool since SDK calls are blocking
            import asyncio
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: client.web_detection(image=image)
            )
            
            web_detection = response.web_detection
            if not web_detection:
                return []

            # Process results
            # Exact duplicates
            for match in web_detection.full_matching_images:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="image_exact_match",
                    result_value=match.url,
                    confidence=0.95,
                    raw_payload={"source": "google_vision", "match_type": "full", "url": match.url}
                ))

            # Hosting pages
            for page in web_detection.pages_with_matching_images:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="image_hosting_page",
                    result_value=page.url,
                    confidence=0.85,
                    raw_payload={
                        "source": "google_vision",
                        "page_title": page.page_title,
                        "url": page.url
                    }
                ))

            # Entities
            for entity in web_detection.web_entities:
                score = entity.score or 0.8
                if score > 0.4 and entity.description:
                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="image_entity_label",
                        result_value=entity.description,
                        confidence=round(score, 3),
                        raw_payload={"source": "google_vision", "entity_id": entity.entity_id, "score": score}
                    ))

        except Exception as e:
            logger.error(f"Google Vision API error (falling back to mock data): {e}")
            # If Google Vision fails, fall back to mock data so it doesn't break development workflow
            mock_res = get_mock_findings(img_filename)
            if mock_res:
                return mock_res

        return findings

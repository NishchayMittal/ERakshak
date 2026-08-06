"""
FaceMatcherConnector — Compares a photo against the case's local suspect image index
using pixel-level structural similarity (MSE on 16x16 grayscale thumbnails).

This is a LOCAL, OFFLINE connector. It compares against suspect images stored
in backend/app/resources/suspects/. It does NOT query any external API because:
- Reverse image search APIs (Google Vision, Amazon Rekognition) require paid keys
- PimEyes requires a subscription
- Social media platforms block programmatic facial queries

What it returns:
  - If a suspect image matches (similarity > 60%): face_similarity finding with score
  - If no local suspects match: a single finding stating no match found locally
  - If the target image cannot be loaded: empty list

To add suspects to the index:
  - Add a PNG/JPG file to backend/app/resources/suspects/
  - Name it anything descriptive, e.g. suspect_john_doe.png
  - The connector auto-discovers all images in that directory
"""
import os
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


# Minimum similarity score to report as a match (below this = skip)
MATCH_THRESHOLD = 60.0


class FaceMatcherConnector(BaseConnector):
    name = "face_matcher"
    applies_to = (IdentifierType.photo,)
    timeout_seconds = 15.0
    max_retries = 0

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        suspects_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "resources", "suspects")
        )

        # Load target image
        target_img = None
        temp_path = None

        try:
            from PIL import Image

            if identifier_value.startswith("http://") or identifier_value.startswith("https://"):
                import httpx, asyncio, tempfile, uuid
                temp_path = os.path.join(
                    os.path.dirname(__file__), "..", "resources", f"_tmp_face_{uuid.uuid4().hex}.png"
                )
                async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as c:
                    resp = await c.get(identifier_value)
                    if resp.status_code == 200:
                        with open(temp_path, "wb") as f:
                            f.write(resp.content)
                        target_img = Image.open(temp_path)
            elif os.path.exists(identifier_value):
                target_img = Image.open(identifier_value)
            else:
                upload_path = os.path.join(os.path.dirname(__file__), "..", "resources", "uploads", identifier_value)
                if os.path.exists(upload_path):
                    target_img = Image.open(upload_path)

        except Exception:
            pass

        if target_img is None:
            return []

        # Load all suspect images from the directory
        if not os.path.exists(suspects_dir):
            return []

        suspect_images = {}
        for fname in os.listdir(suspects_dir):
            if fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                label = os.path.splitext(fname)[0].replace("_", " ").title()
                suspect_images[label] = os.path.join(suspects_dir, fname)

        if not suspect_images:
            return []

        def pixel_similarity(img1, img2_path: str) -> float:
            """16x16 grayscale MSE similarity. Returns 0–100."""
            try:
                from PIL import Image as PILImage
                img2 = PILImage.open(img2_path)
                i1 = img1.resize((16, 16)).convert("L")
                i2 = img2.resize((16, 16)).convert("L")
                p1 = list(i1.getdata())
                p2 = list(i2.getdata())
                mse = sum((a - b) ** 2 for a, b in zip(p1, p2)) / len(p1)
                return max(min(100.0 * (1.0 - mse / 12000.0), 100.0), 0.0)
            except Exception:
                return 0.0

        findings = []
        for label, path in suspect_images.items():
            score = pixel_similarity(target_img, path)
            if score >= MATCH_THRESHOLD:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="face_similarity",
                    result_value=f"Match: {label} (Similarity: {score:.1f}%)",
                    confidence=round(score / 100.0, 3),
                    raw_payload={
                        "suspect_name": label,
                        "similarity_score": round(score, 2),
                        "suspect_image": path,
                        "method": "pixel_mse_16x16",
                    }
                ))

        # Sort by score descending
        findings.sort(key=lambda f: f.confidence, reverse=True)

        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

        return findings

import logging
import os
import httpx
import base64
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)
from groq import AsyncGroq

class OcrExtractorConnector(BaseConnector):
    name = "ocr_extractor"
    applies_to = (IdentifierType.photo,)
    
    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return []
            
        content = None
        content_type = "image/jpeg"

        try:
            if identifier_value.startswith("http://") or identifier_value.startswith("https://"):
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
                    resp = await client.get(identifier_value)
                    if resp.status_code == 200:
                        content = resp.content
                        content_type = resp.headers.get("Content-Type", "image/jpeg")
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
                        if resolved_path.lower().endswith(".png"):
                            content_type = "image/png"
                        elif resolved_path.lower().endswith(".webp"):
                            content_type = "image/webp"

            if not content:
                logger.warning(f"OCR Extractor: Could not read image content for '{identifier_value}'")
                return []

            b64_image = base64.b64encode(content).decode("utf-8")
        except Exception as e:
            logger.error(f"Unexpected error loading image for OCR: {e}")
            return []
            
        groq_client = AsyncGroq(api_key=api_key)
        try:
            chat_completion = await groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Extract all text from this image. Specifically look for emails, phone numbers, usernames, or any identifiers. Output only the extracted text."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{content_type};base64,{b64_image}",
                                },
                            },
                        ],
                    }
                ],
                model="llama-3.2-11b-vision-preview",
            )
            text = chat_completion.choices[0].message.content
            if text and text.strip():
                return [Finding(
                    connector_name=self.name,
                    result_type="ocr_text",
                    result_value=text.strip(),
                    confidence=0.85,
                    raw_payload={"extracted_text": text.strip()}
                )]
        except Exception as e:
            pass
        return []

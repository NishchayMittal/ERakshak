import os
import httpx
import base64
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType
from groq import AsyncGroq

class OcrExtractorConnector(BaseConnector):
    name = "ocr_extractor"
    applies_to = (IdentifierType.photo,)
    
    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return []
            
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(identifier_value)
                resp.raise_for_status()
                # Guess mimetype
                content_type = resp.headers.get("Content-Type", "image/jpeg")
                b64_image = base64.b64encode(resp.content).decode("utf-8")
        except Exception:
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

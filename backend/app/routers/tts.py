import asyncio
import logging
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import edge_tts

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tts"])

class TTSRequest(BaseModel):
    text: str
    lang: str = "en"
    gender: str = "Female"

# Neural Voice lookup mapping
VOICE_MAP = {
    ("en", "Female"): "en-US-AriaNeural",
    ("en", "Male"): "en-US-GuyNeural",
    ("hi", "Female"): "hi-IN-SwaraNeural",
    ("hi", "Male"): "hi-IN-MadhurNeural",
    ("gu", "Female"): "gu-IN-DhwaniNeural",
    ("gu", "Male"): "gu-IN-NiranjanNeural",
}

# In-memory cache for generated TTS audio bytes: (text, norm_lang, norm_gender) -> bytes
_tts_cache: dict[tuple[str, str, str], bytes] = {}
_generation_locks: dict[tuple[str, str, str], asyncio.Lock] = {}
_global_lock = asyncio.Lock()


def normalize_lang(lang: str) -> str:
    lang_lower = (lang or "").lower().strip()
    if lang_lower.startswith("hi"):
        return "hi"
    if lang_lower.startswith("gu"):
        return "gu"
    return "en"


def normalize_gender(gender: str) -> str:
    gender_lower = (gender or "").lower().strip()
    if gender_lower == "male":
        return "Male"
    return "Female"


async def generate_edge_tts_bytes(text: str, lang: str, gender: str) -> bytes:
    norm_lang = normalize_lang(lang)
    norm_gender = normalize_gender(gender)
    cache_key = (text, norm_lang, norm_gender)

    if cache_key in _tts_cache:
        logger.debug(f"TTS cache hit for: lang='{norm_lang}', gender='{norm_gender}'")
        return _tts_cache[cache_key]

    async with _global_lock:
        if cache_key not in _generation_locks:
            _generation_locks[cache_key] = asyncio.Lock()
        lock = _generation_locks[cache_key]

    async with lock:
        # Re-check cache after acquiring per-key lock
        if cache_key in _tts_cache:
            return _tts_cache[cache_key]

        voice = VOICE_MAP.get((norm_lang, norm_gender), "en-US-AriaNeural")
        logger.info(f"Generating Edge Neural TTS audio for '{text[:40]}...' using voice '{voice}'")

        async def _stream():
            communicate = edge_tts.Communicate(text, voice)
            audio_bytes = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes.extend(chunk["data"])
            return bytes(audio_bytes)

        try:
            result = await asyncio.wait_for(_stream(), timeout=10.0)
        except asyncio.TimeoutError:
            raise RuntimeError("Edge TTS request timed out after 10 seconds.")

        if not result:
            raise ValueError("Edge TTS generated empty audio output.")

        _tts_cache[cache_key] = result
        return result


@router.post("/tts")
@router.post("/api/tts")
async def tts_endpoint(payload: TTSRequest):
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty")

    try:
        audio_content = await generate_edge_tts_bytes(
            payload.text.strip(), payload.lang, payload.gender
        )
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        logger.warning(f"Edge TTS generation skipped/failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


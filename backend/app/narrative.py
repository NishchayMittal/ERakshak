import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def generate_narrative(evidence_pack: dict) -> str:
    """
    Generates an intelligence dossier narrative using the Groq API.
    If the API key is missing or invalid, it returns a graceful fallback mock string.
    """
    case_title = evidence_pack.get("case", {}).get("title", "Unknown Case")
    
    fallback_narrative = (
        f"### e-Rakshak Suspect Dossier Intelligence Report\n\n"
        f"**Case**: {case_title}\n\n"
        "> [!WARNING]\n"
        "> This is a placeholder report because the Groq API key is missing or invalid.\n"
        "> Add GROQ_API_KEY to your .env file to generate real AI dossiers.\n\n"
        "**1. Ingest Overview & Intake Summary**\n"
        "Investigation was initiated upon receiving seed domain identifiers indicating suspect activities. Dynamic query scanning was deployed to crawl public RDAP WHOIS databases, Certificate Logs, and historical snapshots.\n\n"
        "**2. Suspect Correlation & Leaks Analysis**\n"
        "Cross-referencing the database against local breach repository archives reveals high-confidence links."
    )

    if not settings.groq_api_key:
        logger.warning("Groq API key not found. Returning fallback narrative.")
        return fallback_narrative

    try:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        
        system_prompt = (
            "You are an expert intelligence analyst compiling a high-level dossier for e-Rakshak.\n"
            "You are given a JSON object containing the Evidence Pack (Case details, Identifiers, Graph Links, and Investigator Notes).\n"
            "Write a highly professional, fully-cited, markdown-formatted Intelligence Report ready for case officers and legal authorities.\n"
            "You MUST structure the report exactly with these sections:\n"
            "1. Target Summary: A high-level overview of the primary subjects, their known aliases, and initial seed identifiers.\n"
            "2. Digital Footprint Analysis: A breakdown of the target's presence across the internet (social media, domains, linked emails, cloud buckets).\n"
            "3. Breach & Security Risks: Analysis of compromised credentials, dark web presence, or security misconfigurations.\n"
            "4. Infrastructure Map: Synthesis of technical infrastructure (IP addresses, open ports, DNS relationships).\n"
            "Whenever you make an assertion based on the evidence, you MUST include an inline citation referencing the specific raw data (e.g., `[Source: Whois Connector - Confidence 0.9]` or `[Identifier ID: xxx]`).\n"
            "Do not include the raw JSON. Highlight critical links and pivot points."
        )
        
        user_prompt = f"Evidence Pack:\n```json\n{json.dumps(evidence_pack, indent=2, default=str)}\n```\n\nGenerate the dossier."
        
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3
        )
        
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        logger.warning(f"Groq API generation failed: {e}. Falling back to mock narrative.")
        return fallback_narrative

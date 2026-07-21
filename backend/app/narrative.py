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


def answer_question_about_evidence(evidence_pack: dict, question: str) -> str:
    """
    Answers a specific question about the evidence using the Groq API.
    If the API key is missing or invalid, it returns a graceful fallback response.
    """
    case_title = evidence_pack.get("case", {}).get("title", "Unknown Case")
    temporal = evidence_pack.get("temporal_analysis", {})
    temporal_summary = temporal.get("tradecraft_summary", "")

    fallback_response = (
        f"**e-Rakshak AI Assistant**\n\n"
        f"> [!NOTE]\n"
        f"> **Case Context**: {case_title}\n\n"
        f"Regarding your query: \"{question}\"\n\n"
    )
    if temporal_summary:
        fallback_response += f"**Temporal Behavioral Footprint**:\n{temporal_summary}\n\n"
    
    fallback_response += (
        f"Based on the case evidence, target activity is aggregated across findings, identifiers, and CDX/WHOIS metadata. "
        f"For advanced natural language reasoning, configure `GROQ_API_KEY` in your `.env` configuration."
    )

    if not settings.groq_api_key:
        logger.warning("Groq API key not found. Returning fallback response.")
        return fallback_response

    try:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)

        system_prompt = (
            "You are an expert intelligence analyst working with the e-Rakshak OSINT platform. "
            "You have access to a comprehensive evidence pack containing case details, identifier information, "
            "temporal behavioral analysis (7x24 activity heatmaps, inferred timezone, circadian sleep patterns, and peak active hours), "
            "findings from various OSINT connectors (WHOIS, crt.sh, Wayback Machine, breach databases, etc.), "
            "investigator notes, and a correlated graph showing connections between entities. "
            "Your task is to answer specific investigatory questions based SOLELY on the provided evidence. "
            "You must:\n"
            "1. Base your answer exclusively on the evidence provided in the evidence pack\n"
            "2. Cite specific sources when making claims (e.g., '[Source: Whois Connector]' or '[Temporal Tradecraft Analysis]')\n"
            "3. If asked about timezones, operating hours, or sleep patterns, leverage the temporal analysis metrics\n"
            "4. Provide clear, concise answers suitable for investigative work\n"
            "5. Maintain a professional, analytical tone appropriate for law enforcement and security professionals"
        )

        user_prompt = f"""Evidence Pack:
```json
{json.dumps(evidence_pack, indent=2, default=str)}
```

Question: {question}

Please answer the question based solely on the evidence provided above."""

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2  # Lower temperature for more focused, factual answers
        )

        return chat_completion.choices[0].message.content

    except Exception as e:
        logger.warning(f"Groq API generation failed: {e}. Falling back to mock response.")
        return fallback_response

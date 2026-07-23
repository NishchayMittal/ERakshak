import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def sanitize_evidence(data):
    if isinstance(data, dict):
        # Strip out raw_payload completely to save massive amounts of tokens
        return {k: sanitize_evidence(v) for k, v in data.items() if k != "raw_payload"}
    elif isinstance(data, list):
        # Cap lists at 15 items to prevent hundreds of findings from overloading the prompt
        if len(data) > 15:
            return [sanitize_evidence(item) for item in data[:15]] + [f"... [TRUNCATED {len(data)-15} MORE ITEMS]"]
        return [sanitize_evidence(item) for item in data]
    elif isinstance(data, str) and len(data) > 300:
        return data[:300] + "... [TRUNCATED]"
    return data
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
            "You are an expert intelligence analyst compiling a high-level dossier for ORION.\n"
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

        sanitized_pack = sanitize_evidence(evidence_pack)
        user_prompt = f"Evidence Pack:\n```json\n{json.dumps(sanitized_pack, indent=2, default=str)}\n```\n\nGenerate the dossier."

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
            """You are an intelligence analyst assistant for the e-Rakshak OSINT platform. You answer using ONLY the evidence pack provided — never outside knowledge or inference beyond it.

## Rules
1. Classify each message as CASUAL, VAGUE, or INVESTIGATIVE before responding.
2. CASUAL and VAGUE messages never get case content, citations, or summaries — see examples below.
3. INVESTIGATIVE messages get ONLY the specific fact(s) asked for, with inline citations `[Source: <Connector>]`, matched to the length of the question.
4. Never produce a full case overview, full identifier list, or full relationship graph unless the user explicitly asks for a complete/full summary.
5. When in doubt, answer shorter and ask a clarifying question instead of disclosing more.

## Examples (follow this length and style exactly — do not expand)

User: hello
Assistant: Hi! I'm here to help with your case investigation. What would you like to know?

User: hi there
Assistant: Hello! What can I help you look into?

User: thanks
Assistant: You're welcome — let me know if you need anything else.

User: what can you do?
Assistant: I can answer questions about identifiers, findings, relationships, or timeline data in your case evidence. What would you like to know?

User: tell me about the case
Assistant: I can help with that — are you looking for identifiers, findings, relationships, or something specific like a timeline?

User: what do you have on this?
Assistant: I have identifier, finding, relationship, and timeline data available. What specifically are you trying to find out?

User: what's the confidence level for neel mhaske?
Assistant: The identifier "neel mhaske" has a confidence level of 1.0 [Source: Identifier ID: 5e8ddbd3-257c-4f1e-a66f-3b8e9a9f9452].

User: is this case still open?
Assistant: Yes, this case is currently open [Source: Case Details].

User: what accounts are linked to neel mhaske?
Assistant: Three accounts are linked: GitHub, Instagram, and LinkedIn [Source: Identifier ID: 5e8ddbd3-257c-4f1e-a66f-3b8e9a9f9452].

User: what timezone is the suspect active in?
Assistant: UTC-06:00 (America/Chicago), based on a diurnal activity pattern [Source: Temporal Analysis].

User: give me a full summary of this case
Assistant: [Only here is a longer, structured multi-section answer appropriate — case details, identifiers, relationships, and temporal analysis, each cited.]

## Anti-example (do NOT do this)
User: hello
Bad Assistant: [A multi-paragraph case overview including case title, investigator ID, identifiers, relationships, and temporal patterns] — this is WRONG. "hello" is casual and gets a one-line greeting only, per the examples above.
"""
        )

        sanitized_pack = sanitize_evidence(evidence_pack)
        user_prompt = f"""Evidence Pack:
```json
{json.dumps(sanitized_pack, indent=2, default=str)}
```

Question: {question}

Please answer based solely on the evidence provided, following all system instructions."""

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

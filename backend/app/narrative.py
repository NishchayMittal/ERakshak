import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def generate_narrative(evidence_pack: dict) -> str:
    """
    Generates an intelligence dossier narrative using a local Ollama LLM.
    If the Ollama server is unreachable, it returns a graceful fallback mock string.
    """
    case_title = evidence_pack.get("case", {}).get("title", "Unknown Case")
    
    fallback_narrative = (
        f"### e-Rakshak Suspect Dossier Intelligence Report\n\n"
        f"**Case**: {case_title}\n\n"
        "> [!WARNING]\n"
        "> This is a placeholder report because the local Ollama LLM server could not be reached.\n"
        "> Ensure you have installed Ollama and pulled the 'llama3' model.\n\n"
        "**1. Ingest Overview & Intake Summary**\n"
        "Investigation was initiated upon receiving seed domain identifiers indicating suspect activities. Dynamic query scanning was deployed to crawl public RDAP WHOIS databases, Certificate Logs, and historical snapshots.\n\n"
        "**2. Suspect Correlation & Leaks Analysis**\n"
        "Cross-referencing the database against local breach repository archives reveals high-confidence links."
    )

    try:
        import ollama
        client = ollama.Client(host=settings.ollama_base_url)
        
        system_prompt = (
            "You are an expert intelligence analyst compiling a dossier for e-Rakshak.\n"
            "You are given a JSON object containing the Evidence Pack (Case details, Identifiers, Graph Links, and Investigator Notes).\n"
            "Write a concise, professional, markdown-formatted Intelligence Report summarizing the findings and correlations.\n"
            "Do not include the raw JSON. Highlight critical links and pivot points."
        )
        
        user_prompt = f"Evidence Pack:\n```json\n{json.dumps(evidence_pack, indent=2)}\n```\n\nGenerate the dossier."
        
        response = client.chat(
            model='llama3',
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            options={'temperature': 0.3}
        )
        
        return response['message']['content']
        
    except Exception as e:
        logger.warning(f"Ollama generation failed: {e}. Falling back to mock narrative.")
        return fallback_narrative

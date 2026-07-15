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
        
        # Try to use configured model first, falling back to installed ones if not found
        model_name = settings.ollama_model
        try:
            models_response = client.list()
            # Handle both dict-based and object-based responses from ollama python library
            models_list = []
            if isinstance(models_response, dict):
                models_list = models_response.get('models', [])
            else:
                models_list = getattr(models_response, 'models', [])

            available = []
            for m in models_list:
                name = None
                if isinstance(m, dict):
                    name = m.get('model', m.get('name'))
                else:
                    name = getattr(m, 'model', getattr(m, 'name', None))
                if name:
                    available.append(name)

            if available:
                # If configured model is not installed, dynamically select a fallback
                is_configured_available = any(m == model_name or m.startswith(model_name + ':') for m in available)
                if not is_configured_available:
                    preferred_order = ['llama3.2', 'gemma:2b', 'qwen2.5', 'llama3']
                    selected = None
                    for pref in preferred_order:
                        match = next((m for m in available if pref in m), None)
                        if match:
                            selected = match
                            break
                    if not selected:
                        selected = available[0]
                    model_name = selected
                logger.info(f"Using Ollama model: {model_name}")
        except Exception as list_err:
            logger.warning(f"Failed to query model list: {list_err}. Defaulting to configuration: {model_name}")
        
        system_prompt = (
            "You are an expert intelligence analyst compiling a dossier for e-Rakshak.\n"
            "You are given a JSON object containing the Evidence Pack (Case details, Identifiers, Graph Links, and Investigator Notes).\n"
            "Write a concise, professional, markdown-formatted Intelligence Report summarizing the findings and correlations.\n"
            "Do not include the raw JSON. Highlight critical links and pivot points."
        )
        
        user_prompt = f"Evidence Pack:\n```json\n{json.dumps(evidence_pack, default=str, indent=2)}\n```\n\nGenerate the dossier."
        
        # Compile prioritized list of candidate models to try
        candidates = [model_name]
        for m in available:
            if m not in candidates:
                candidates.append(m)
        for std in ['qwen2.5:0.5b', 'llama3.2', 'gemma:2b', 'llama3']:
            if not any(std in c for c in candidates):
                candidates.append(std)

        last_error = None
        for candidate in candidates:
            try:
                logger.info(f"Attempting Ollama generation with model: {candidate}")
                response = client.chat(
                    model=candidate,
                    messages=[
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': user_prompt}
                    ],
                    options={'temperature': 0.3}
                )
                logger.info(f"Ollama generation succeeded using model: {candidate}")
                return response['message']['content']
            except Exception as chat_err:
                last_error = chat_err
                logger.warning(f"Ollama generation failed for model {candidate}: {chat_err}. Trying backup...")

        if last_error:
            raise last_error
        
    except Exception as e:
        logger.warning(f"Ollama generation failed: {e}. Falling back to mock narrative.")
        return fallback_narrative

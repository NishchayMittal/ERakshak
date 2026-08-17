from __future__ import annotations

import logging
import re
import json
from typing import Any

from groq import Groq

from app.config import settings

def normalize_text(text: Any) -> str:
    if text is None:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()

def sanitize_evidence(data):
    """Recursively truncates large lists, strings, and removes raw_payloads."""
    if isinstance(data, dict):
        return {k: sanitize_evidence(v) for k, v in data.items() if k != "raw_payload"}
    elif isinstance(data, list):
        if len(data) > 15:
            return [sanitize_evidence(item) for item in data[:15]] + [f"... [TRUNCATED {len(data)-15} MORE ITEMS]"]
        return [sanitize_evidence(item) for item in data]
    elif isinstance(data, str) and len(data) > 300:
        return data[:300] + "... [TRUNCATED]"
    return data

def compact_evidence_pack(evidence_pack: dict, max_nodes: int = 15) -> dict:
    import copy
    ep = copy.deepcopy(evidence_pack)
    
    # Strip heavy fields from case and notes
    if "case" in ep:
        ep["case"].pop("created_at", None)
        ep["case"].pop("updated_at", None)
        
    if "notes" in ep:
        for note in ep["notes"]:
            note.pop("created_at", None)
            note.pop("author_id", None)
            if "content" in note and len(note["content"]) > 300:
                note["content"] = note["content"][:300] + "..."
                
    # Strip raw payload from graph if it exists, and sort/truncate nodes
    if "graph" in ep and "nodes" in ep["graph"]:
        nodes = ep["graph"]["nodes"]
        edges = ep["graph"]["edges"]
        
        # Sort nodes by confidence and pivot status
        nodes.sort(key=lambda n: (n.get("pivot", False), n.get("confidence", 0.0)), reverse=True)
        
        if len(nodes) > max_nodes:
            top_nodes = nodes[:max_nodes]
            top_node_ids = {n["id"] for n in top_nodes}
            
            # Keep only edges connecting these top nodes
            filtered_edges = [e for e in edges if e.get("source") in top_node_ids and e.get("target") in top_node_ids]
            
            # Actively strip bulky data from the nodes and edges
            for n in top_nodes:
                n.pop("raw_payload", None)
                n.pop("profile_url", None)
                n.pop("expand_investigation", None)
                n.pop("timestamp", None)
                if "label" in n and len(n["label"]) > 100:
                    n["label"] = n["label"][:100] + "..."
                    
            for e in filtered_edges:
                e.pop("raw_payload", None)
                e.pop("timestamp", None)
                
            ep["graph"]["nodes"] = top_nodes
            ep["graph"]["edges"] = filtered_edges
            ep["graph"]["_truncation_warning"] = f"Graph truncated from {len(nodes)} down to top {max_nodes} nodes to fit API limits."
            
    return ep

logger = logging.getLogger(__name__)



def _local_fallback_narrative(evidence_pack: dict, error_msg: str = "") -> str:
    case = evidence_pack.get("case", {}) or {}
    case_title = normalize_text(case.get("title") or "Unknown Case")
    case_status = normalize_text(case.get("status") or "unknown")
    
    error_note = f" API Generation Error: {error_msg}" if error_msg else ""

    return (
        f"### e-Rakshak Suspect Dossier Intelligence Report\n\n"
        f"**Case**: {case_title}\n"
        f"**Status**: {case_status}\n\n"
        "> [!WARNING]\n"
        f"> The AI narrative generation API failed to assemble a full report.{error_note}\n\n"
        "No indexed evidence was available yet to synthesize a grounded dossier, or the API is currently offline. Re-run ingestion or refresh the case index after adding identifiers, findings, notes, or temporal analysis."
    )


def _local_fallback_response(evidence_pack: dict, question: str, error_msg: str = "") -> str:
    case = evidence_pack.get("case", {}) or {}
    case_title = normalize_text(case.get("title") or "Unknown Case")
    temporal = evidence_pack.get("temporal_analysis", {}) or {}
    temporal_summary = normalize_text(temporal.get("tradecraft_summary") or "")

    response = (
        f"**e-Rakshak AI Assistant**\n\n"
        f"> [!NOTE]\n"
        f"> **Case Context**: {case_title}\n\n"
        f"Regarding your query: \"{normalize_text(question)}\"\n\n"
    )
    if temporal_summary:
        response += f"**Temporal Behavioral Footprint**:\n{temporal_summary}\n\n"
    response += (
        "The AI API could not surface enough grounded evidence for a richer answer. Try a more specific question or ingest more case evidence."
    )
    return response


def generate_narrative(evidence_pack: dict, language: str = "en") -> str:
    """Generate the dossier narrative using Groq API."""
    api_key = settings.groq_api_key
    if not api_key:
        return _local_fallback_narrative(evidence_pack, "GROQ_API_KEY is not set.")

    try:
        client = Groq(api_key=api_key)
        prompt = (
            "You are an OSINT Intelligence Analyst AI working for e-Rakshak.\n"
            "Based on the following JSON evidence pack, synthesize a professional, highly structured, and objective Suspect Dossier Report.\n"
            "CRITICAL: Keep the report extremely concise (under 500 words) to respect strict output limits. Focus only on the most critical findings.\n"
            "Use Markdown formatting (like `### ` headings, bold text, bullets, and blockquotes for important notes).\n"
            "Do not output anything outside of the Markdown report.\n"
        )
        
        if language == "hi":
            prompt += "CRITICAL INSTRUCTION: You MUST write the ENTIRE report in Hindi language and Devanagari script. DO NOT write in English.\n\n"
        elif language == "gu":
            prompt += "CRITICAL INSTRUCTION: You MUST write the ENTIRE report in Gujarati language and Gujarati script. DO NOT write in English.\n\n"
        else:
            prompt += "Write the report in English.\n\n"
            
        evidence_json = json.dumps(sanitize_evidence(compact_evidence_pack(evidence_pack, max_nodes=10)), default=str)
        if len(evidence_json) > 8000:
            evidence_json = evidence_json[:8000] + "\n...[TRUNCATED TO FIT LIMITS]"
            
        prompt += (
            "Evidence Pack:\n"
            f"{evidence_json}\n"
        )
        completion = client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=3000,
        )
        content = completion.choices[0].message.content or ""
        
        # Strip out any <think> blocks used by reasoning models (like Qwen/DeepSeek)
        content = re.sub(r'<think>.*?(?:</think>|$)', '', content, flags=re.DOTALL).strip()
        
        if content.startswith("```markdown"):
            content = content[11:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip() or _local_fallback_narrative(evidence_pack, "Empty response from API")
    except Exception as exc:
        logger.warning(f"Groq API narrative generation failed: {exc}")
        return _local_fallback_narrative(evidence_pack, str(exc))


def answer_question_about_evidence(evidence_pack: dict, question: str, history: list[dict[str, str]] | None = None, language: str = "en") -> str:
    """Generate a conversational AI response using Groq."""
    try:
        api_key = settings.groq_api_key
        if not api_key:
            logger.warning("GROQ_API_KEY is not set. Using local fallback response.")
            return _local_fallback_response(evidence_pack, question, "GROQ_API_KEY not found.")

        client = Groq(api_key=api_key)

        sys_prompt = (
            "You are a highly capable AI OSINT assistant inside the e-Rakshak intelligence platform.\n"
            "You can answer general conversational questions, explain concepts, and analyze the case data provided.\n"
            "If the user asks a normal question or greets you, answer it conversationally.\n"
            "If they ask about the case or OSINT data, use the evidence pack provided below to answer accurately.\n"
            "Keep your responses concise and format them cleanly using Markdown (bold, lists, etc).\n"
        )
        
        if language == "hi":
            sys_prompt += "CRITICAL INSTRUCTION: You MUST reply entirely in Hindi language and Devanagari script. DO NOT use English.\n\n"
        elif language == "gu":
            sys_prompt += "CRITICAL INSTRUCTION: You MUST reply entirely in Gujarati language and Gujarati script. DO NOT use English.\n\n"
        else:
            sys_prompt += "Reply in English.\n\n"
            
        evidence_json = json.dumps(sanitize_evidence(compact_evidence_pack(evidence_pack, max_nodes=5)), default=str)
        if len(evidence_json) > 8000:
            evidence_json = evidence_json[:8000] + "\n...[TRUNCATED TO FIT LIMITS]"
            
        sys_prompt += (
            f"Evidence Pack:\n{evidence_json}\n"
        )
        
        messages = [{"role": "system", "content": sys_prompt}]
        
        if history:
            # Only keep the last 4 messages to save tokens for strict models
            for msg in history[-4:]:
                if msg.get("role") in ["user", "assistant"] and msg.get("content"):
                    messages.append({"role": msg["role"], "content": msg["content"]})
                    
        messages.append({"role": "user", "content": question})

        completion = client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=messages,
            temperature=0.3,
            max_tokens=3000,
        )
        content = completion.choices[0].message.content or ""
        
        # Strip out any <think> blocks used by reasoning models (like Qwen/DeepSeek)
        content = re.sub(r'<think>.*?(?:</think>|$)', '', content, flags=re.DOTALL).strip()
        
        if content.startswith("```markdown"):
            content = content[11:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip() or _local_fallback_response(evidence_pack, question, "Empty response from API")
    except Exception as exc:
        logger.warning(f"Groq API chat generation failed: {exc}")
        return _local_fallback_response(evidence_pack, question, str(exc))

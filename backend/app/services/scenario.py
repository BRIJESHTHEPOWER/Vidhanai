import json
import re
from app.services.ai import generate_json_response

# ── In-memory cache: ipc_section → list of steps ──
_scenario_cache: dict = {}


def generate_scenario(law: dict) -> list:
    """
    Generate 4-step legal scenario for a given law dict via Gemini.
    Returns list of step dicts with keys: step, phase, title, story, ipc_ref, icon.
    """
    ipc = law.get("ipc_section", "")
    if ipc in _scenario_cache:
        return _scenario_cache[ipc]

    system_prompt = "You are a legal storytelling assistant for Indian law education. Return ONLY valid JSON array."
    user_prompt = f"""Given this law, create a 4-step real-life story scenario showing how this law works.

Law: {law.get('title')}
IPC Section: {law.get('ipc_section')} / BNS Section: {law.get('bns_section')}
Description: {law.get('description')}
Punishment: {law.get('punishment')}
Real-Life Example: {law.get('real_life_example', '')}
Simple Explanation: {law.get('simple_explanation', '')}

Create exactly 4 steps in this order:
1. Incident — What happened? (the crime/event)
2. Police Action — What did authorities do?
3. Law Applied — Which IPC/BNS section applies and why?
4. Outcome — What was the verdict/consequence?

Rules:
- Use simple, beginner-friendly language (Class 8 level)
- Each story should be 2-3 sentences max
- Use realistic Indian names and settings
- Keep it factual, not dramatic
- The IPC section MUST be mentioned in step 3

Return ONLY valid JSON:
[
  {{
    "step": 1,
    "phase": "Incident",
    "title": "short title",
    "story": "2-3 sentence story",
    "ipc_ref": "{law.get('ipc_section')}",
    "icon": "🔍"
  }},
  {{
    "step": 2,
    "phase": "Police Action",
    "title": "short title",
    "story": "2-3 sentence story",
    "ipc_ref": "{law.get('ipc_section')}",
    "icon": "👮"
  }},
  {{
    "step": 3,
    "phase": "Law Applied",
    "title": "short title",
    "story": "2-3 sentence story mentioning IPC {law.get('ipc_section')}",
    "ipc_ref": "{law.get('ipc_section')}",
    "icon": "⚖️"
  }},
  {{
    "step": 4,
    "phase": "Outcome",
    "title": "short title",
    "story": "2-3 sentence story",
    "ipc_ref": "{law.get('ipc_section')}",
    "icon": "🏛️"
  }}
]"""

    try:
        content = generate_json_response(system_prompt, user_prompt, temperature=0.7)
        content = content.strip()
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        steps = json.loads(content)
        _scenario_cache[ipc] = steps
        return steps
    except Exception:
        fallback = [
            {
                "step": 1, "phase": "Incident",
                "title": "The Event",
                "story": law.get("real_life_example", law.get("simple_explanation", "An incident occurred involving " + law.get("title", "this law") + ".")),
                "ipc_ref": ipc, "icon": "🔍"
            },
            {
                "step": 2, "phase": "Police Action",
                "title": "Authorities Respond",
                "story": "The victim filed a police complaint. Officers registered an FIR and began investigation under the relevant sections.",
                "ipc_ref": ipc, "icon": "👮"
            },
            {
                "step": 3, "phase": "Law Applied",
                "title": f"IPC {ipc} Invoked",
                "story": f"The court applied IPC Section {ipc} (BNS {law.get('bns_section', '')}). {law.get('description', '')}",
                "ipc_ref": ipc, "icon": "⚖️"
            },
            {
                "step": 4, "phase": "Outcome",
                "title": "Verdict",
                "story": f"The accused was found guilty. Under IPC {ipc}, the punishment is: {law.get('punishment', 'as per court discretion')}.",
                "ipc_ref": ipc, "icon": "🏛️"
            }
        ]
        _scenario_cache[ipc] = fallback
        return fallback

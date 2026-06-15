import json
from app.services.ai import generate_json_response


def generate_story(context, question, language="English"):
    """Generate comic-style story scenes via Gemini (NOT Groq)."""
    system_prompt = (
        "You are a legal storyteller for Indian law education. "
        "Return ONLY a valid JSON array, no markdown."
    )
    user_prompt = f"""Based on the given law context, create a short comic-style story.

Make 3 scenes.

Each scene should have:
- scene title
- description
- dialogue

Generate the scene titles, descriptions (text), and dialogue STRICTLY in the {language} language.
Keep the JSON keys (scene, text, dialogue) in English.

Context:
{context}

Question:
{question}

Return ONLY JSON like:
[
  {{
    "scene": "Scene 1",
    "text": "...",
    "dialogue": "..."
  }}
]"""

    try:
        content = generate_json_response(system_prompt, user_prompt, temperature=0.7)
        content = content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content.strip())
    except Exception:
        return [
            {
                "scene": "Scene 1",
                "text": "Story generation failed",
                "dialogue": "",
            }
        ]

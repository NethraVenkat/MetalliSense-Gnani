"""
Genuine Google Gemini Integration for Explainable AI (alternative to Groq/Claude)

Note: the ORIGINAL project's geminiService.js was misleadingly named — it
actually called Groq internally (its own comment said "Using same env var
for Groq API key"). This file is a REAL integration with Google's actual
Gemini API, using the current `google-genai` SDK (the older
`google-generativeai` package is fully deprecated as of this writing —
deliberately not used here).

Same public interface as groq_explainer.ExplainableAICopilot and
claude_explainer.ClaudeExplainableAICopilot, so it's a drop-in swap —
controlled by the COPILOT_PROVIDER env var, main.py doesn't change.

⚠️ This has NOT been tested against a live Gemini API call — no Google
Gemini API key is available in the environment this was built in. The
request/response shape matches Google's current google-genai SDK docs
exactly, and package installation + the "no key" error path were both
confirmed working, but the actual API call is unverified. If it errors,
paste the exact error and it can be fixed from the real behavior.

Setup: pip install google-genai, then set GOOGLE_GEMINI_API_KEY in your
environment (get one at https://aistudio.google.com/apikey).
"""
import os
import re
import json
from typing import Dict, List, Optional
from datetime import datetime


def strip_markdown(text: str) -> str:
    """Remove common markdown formatting (bold/italic asterisks, header
    hashes, bullet asterisks) so responses display as clean plain text in
    the UI, which doesn't render markdown."""
    if not text:
        return text
    # **bold** or *italic* -> plain text (keeps the words, drops the stars)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    # Leading markdown headers like "### Summary" -> "Summary"
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Bullet markers "* item" or "- item" at line start -> "• item"
    text = re.sub(r"^[\*\-]\s+", "• ", text, flags=re.MULTILINE)
    # Any remaining stray asterisks (e.g. inline bullets not at line start)
    text = text.replace("**", "").replace("* ", "• ")
    return text

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:
    genai = None
    genai_types = None


class GeminiExplainableAICopilot:
    """
    AI Copilot that explains ML model predictions using Google's real
    Gemini API. Same public interface as the Groq/Claude explainers:
    explain_analysis(), chat(), clear_history().
    """

    def __init__(self, api_key: Optional[str] = None):
        if genai is None:
            raise ImportError(
                "The 'google-genai' package is not installed. Run: pip install google-genai"
            )

        self.api_key = api_key or os.getenv("GOOGLE_GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Google Gemini API key not found. Set GOOGLE_GEMINI_API_KEY "
                "environment variable or pass api_key parameter. Get one at "
                "https://aistudio.google.com/apikey"
            )

        self.client = genai.Client(api_key=self.api_key)
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self.conversation_history = []  # list of {"role": "user"|"model", "text": ...}
        self._last_context = None

    def explain_analysis(
        self,
        composition: Dict[str, float],
        grade: str,
        anomaly_result: Dict,
        alloy_result: Dict,
    ) -> Dict:
        context = self._build_analysis_context(composition, grade, anomaly_result, alloy_result)
        prompt = self._create_explanation_prompt(context)

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=self._get_system_prompt(),
                temperature=0.3,
                max_output_tokens=2000,
            ),
        )

        explanation_text = strip_markdown(response.text)
        self._last_context = context
        return self._structure_explanation(explanation_text, context)

    def chat(self, user_message: str, include_context: bool = True) -> Dict:
        context = self._last_context if include_context else None

        # Build the full contents list: prior turns + the new message.
        contents = []
        for turn in self.conversation_history[-10:]:
            contents.append({"role": turn["role"], "parts": [{"text": turn["text"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=genai_types.GenerateContentConfig(
                system_instruction=self._get_chatbot_system_prompt(context),
                temperature=0.5,
                max_output_tokens=1000,
            ),
        )

        assistant_message = strip_markdown(response.text)

        self.conversation_history.append({"role": "user", "text": user_message})
        self.conversation_history.append({"role": "model", "text": assistant_message})

        return {
            "response": assistant_message,
            "conversation_id": f"conv_{len(self.conversation_history)}",
        }

    def clear_history(self):
        self.conversation_history = []

    # ---- mirrors groq_explainer.py / claude_explainer.py structure ----

    def _build_analysis_context(self, composition, grade, anomaly_result, alloy_result) -> Dict:
        return {
            "composition": composition,
            "grade": grade,
            "anomaly": {
                "score": anomaly_result.get("anomaly_score", 0),
                "severity": anomaly_result.get("severity", "UNKNOWN"),
                "confidence": anomaly_result.get("confidence", 0),
            },
            "alloy_recommendations": alloy_result.get("recommended_additions", {}),
            "alloy_confidence": alloy_result.get("confidence", 0),
        }

    def _get_system_prompt(self) -> str:
        return """You are MetalliSense AI Copilot, an expert metallurgical engineer assistant for foundry operators.

Your role is to explain machine learning predictions in clear, actionable language that foundry operators can understand and trust.

Key responsibilities:
1. Explain WHY deviations matter (not just WHAT they are)
2. Justify EACH alloy addition with metallurgical reasoning
3. Provide risk analysis if corrections are skipped
4. Use operator-friendly language (avoid ML jargon)
5. Be specific with numbers and percentages
6. Structure explanations clearly with bullet points
7. Write in PLAIN TEXT only — do not use markdown formatting like **bold**, *italics*, or # headers, since the display does not render markdown

Remember:
- You are explaining ML predictions, not making them
- Focus on practical implications for the operator
- Emphasize quality outcomes and material efficiency
- Build trust through transparency"""

    def _get_chatbot_system_prompt(self, context: Optional[Dict]) -> str:
        base_prompt = """You are MetalliSense AI Copilot, a friendly and knowledgeable assistant for foundry operators.

You help operators understand their metal composition analysis, answer questions about alloy corrections, and provide metallurgical guidance.

Your personality:
- Professional but approachable
- Patient and educational
- Focused on practical solutions
- Clear and concise
- Plain text only — never use markdown formatting like **bold** or # headers, since the display does not render markdown

Always:
- Refer to the latest analysis when relevant
- Explain technical concepts simply
- Provide actionable advice
- Acknowledge when you don't have specific information"""

        if context:
            base_prompt += f"\n\nCurrent Analysis Context:\n{json.dumps(context, indent=2)}"

        return base_prompt

    def _create_explanation_prompt(self, context: Dict) -> str:
        comp = context["composition"]
        grade = context["grade"]
        anomaly = context["anomaly"]
        recommendations = context["alloy_recommendations"]

        return f"""Analyze this foundry composition and provide a comprehensive explanation:

**Current Composition:**
{json.dumps(comp, indent=2)}

**Target Grade:** {grade}

**Anomaly Detection Results:**
- Severity: {anomaly['severity']}
- Anomaly Score: {anomaly['score']:.4f}
- Confidence: {anomaly['confidence']:.4f}

**ML Recommended Alloy Additions:**
{json.dumps(recommendations, indent=2) if recommendations else "None (composition within acceptable range)"}

**Provide the following:**

1. **Situation Summary** (2-3 sentences)
2. **Detailed Deviation Analysis**
3. **Alloy Addition Justification** (for each addition: why, what it improves, what happens if skipped)
4. **Risk Assessment** (rejection probability, quality issues, material waste)
5. **Operator Action Items** (step-by-step, priority order, verification steps)
6. **Confidence Level** (how confident should the operator be, any cautions)

Format your response clearly with headers and bullet points."""

    def _structure_explanation(self, explanation_text: str, context: Dict) -> Dict:
        return {
            "explanation": explanation_text,
            "context": context,
            "summary": self._extract_summary(explanation_text),
            "action_items": self._extract_action_items(explanation_text),
            "risk_level": context["anomaly"]["severity"],
            "confidence": context["alloy_confidence"],
            "timestamp": datetime.now().isoformat(),
            "provider": "google-gemini",
        }

    def _extract_summary(self, text: str) -> str:
        lines = text.split("\n")
        summary_lines = []
        for i, line in enumerate(lines):
            if "situation summary" in line.lower():
                for j in range(i + 1, min(i + 5, len(lines))):
                    if lines[j].strip() and not lines[j].startswith("#"):
                        summary_lines.append(lines[j].strip())
                break
        return " ".join(summary_lines[:3]) if summary_lines else text[:200]

    def _extract_action_items(self, text: str) -> List[str]:
        lines = text.split("\n")
        actions = []
        in_action_section = False
        for line in lines:
            if "operator action" in line.lower() or "action item" in line.lower():
                in_action_section = True
                continue
            if in_action_section:
                if line.strip().startswith("-") or line.strip().startswith("*"):
                    actions.append(line.strip().lstrip("-*").strip())
                elif line.startswith("#"):
                    break
        return actions[:5]


_gemini_copilot_instance = None


def get_gemini_copilot() -> GeminiExplainableAICopilot:
    global _gemini_copilot_instance
    if _gemini_copilot_instance is None:
        _gemini_copilot_instance = GeminiExplainableAICopilot()
    return _gemini_copilot_instance
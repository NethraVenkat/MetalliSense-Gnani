"""
Anthropic Claude Integration for Explainable AI (alternative to Groq)

Same interface as groq_explainer.ExplainableAICopilot, so it's a drop-in
swap — main.py doesn't need to change, only which class __init__.py
exports (controlled by the COPILOT_PROVIDER env var).

⚠️ This has NOT been tested against a live Anthropic API call — I have no
Anthropic API key in the environment I built this in. The request/response
shape matches Anthropic's public Messages API documentation exactly, but
you are the first to actually run this against a real key. If it errors,
paste the exact error and it can be fixed from the real behavior.

Setup: pip install anthropic, then set ANTHROPIC_API_KEY in your
environment (get one at https://console.anthropic.com/).
"""
import os
import json
from typing import Dict, List, Optional
from datetime import datetime

try:
    import anthropic
except ImportError:
    anthropic = None


class ClaudeExplainableAICopilot:
    """
    AI Copilot that explains ML model predictions using Claude, instead of
    Groq. Same public interface as ExplainableAICopilot (groq_explainer.py):
    explain_analysis(), chat(), clear_history().
    """

    def __init__(self, api_key: Optional[str] = None):
        if anthropic is None:
            raise ImportError(
                "The 'anthropic' package is not installed. Run: pip install anthropic"
            )

        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Anthropic API key not found. Set ANTHROPIC_API_KEY environment "
                "variable or pass api_key parameter. Get one at "
                "https://console.anthropic.com/"
            )

        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
        self.conversation_history = []
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

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            temperature=0.3,
            system=self._get_system_prompt(),
            messages=[{"role": "user", "content": prompt}],
        )

        explanation_text = response.content[0].text
        self._last_context = context
        return self._structure_explanation(explanation_text, context)

    def chat(self, user_message: str, include_context: bool = True) -> Dict:
        context = self._last_context if include_context else None

        messages = list(self.conversation_history[-10:])
        messages.append({"role": "user", "content": user_message})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            temperature=0.5,
            system=self._get_chatbot_system_prompt(context),
            messages=messages,
        )

        assistant_message = response.content[0].text

        self.conversation_history.append({"role": "user", "content": user_message})
        self.conversation_history.append({"role": "assistant", "content": assistant_message})

        return {
            "response": assistant_message,
            "conversation_id": f"conv_{len(self.conversation_history)}",
        }

    def clear_history(self):
        self.conversation_history = []

    # ---- everything below mirrors groq_explainer.py exactly, so the two
    # providers produce comparably-structured output ----

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
   - What's the current state of this melt?
   - Is immediate action needed?

2. **Detailed Deviation Analysis**
   - Which elements are out of specification?
   - How much are they deviated?
   - What are the metallurgical implications?

3. **Alloy Addition Justification**
   - For EACH recommended addition, explain:
     * Why this specific alloy?
     * What property will it improve?
     * What happens if we skip it?

4. **Risk Assessment**
   - What's the probability of rejection if corrections are skipped?
   - What quality issues might arise?
   - Material waste implications?

5. **Operator Action Items**
   - Clear step-by-step instructions
   - Priority order of additions
   - Verification steps

6. **Confidence Level**
   - How confident should the operator be in this recommendation?
   - Any uncertainties or cautions?

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
            "provider": "anthropic-claude",
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


_claude_copilot_instance = None


def get_claude_copilot() -> ClaudeExplainableAICopilot:
    global _claude_copilot_instance
    if _claude_copilot_instance is None:
        _claude_copilot_instance = ClaudeExplainableAICopilot()
    return _claude_copilot_instance

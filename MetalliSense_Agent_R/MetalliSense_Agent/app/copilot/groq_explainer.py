"""
Groq LLM Integration for Explainable AI
Converts ML predictions into human-readable explanations
"""
import os
import re
from typing import Dict, List, Optional
from groq import Groq
import json


def strip_markdown(text: str) -> str:
    """Remove common markdown formatting (bold/italic asterisks, header
    hashes, bullet asterisks) so responses display as clean plain text in
    the UI, which doesn't render markdown."""
    if not text:
        return text
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[\*\-]\s+", "• ", text, flags=re.MULTILINE)
    text = text.replace("**", "").replace("* ", "• ")
    return text


class ExplainableAICopilot:
    """
    AI Copilot that explains ML model predictions using Groq LLM
    
    Features:
    - Converts numeric predictions to natural language
    - Provides step-by-step reasoning
    - What-if analysis
    - Risk assessment
    - Operator-friendly guidance
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Groq client
        
        Args:
            api_key: Groq API key (if None, reads from env)
        """
        self.api_key = api_key or os.getenv('GROQ_API_KEY')
        
        if not self.api_key:
            raise ValueError(
                "Groq API key not found. Set GROQ_API_KEY environment variable "
                "or pass api_key parameter"
            )
        
        self.client = Groq(api_key=self.api_key)
        # llama-3.3-70b-versatile was deprecated by Groq (June 2026) — using
        # their officially recommended replacement for that model tier.
        self.model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.conversation_history = []
    
    def explain_analysis(
        self,
        composition: Dict[str, float],
        grade: str,
        anomaly_result: Dict,
        alloy_result: Dict
    ) -> Dict:
        """
        Generate comprehensive explanation of ML analysis
        
        Args:
            composition: Current composition
            grade: Target grade
            anomaly_result: Output from anomaly detection agent
            alloy_result: Output from alloy correction agent
            
        Returns:
            Dictionary with explanation, reasoning, and recommendations
        """
        # Build context for Groq
        context = self._build_analysis_context(
            composition, grade, anomaly_result, alloy_result
        )
        
        # Create prompt for explanation
        prompt = self._create_explanation_prompt(context)
        
        # Get explanation from Groq
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": self._get_system_prompt()
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,  # Lower for more consistent technical explanations
            max_tokens=2000
        )
        
        explanation_text = strip_markdown(response.choices[0].message.content)
        
        # Store context for chat
        self._last_context = context
        
        # Parse and structure the explanation
        return self._structure_explanation(explanation_text, context)
    
    def chat(self, user_message: str, include_context: bool = True) -> Dict:
        """
        Interactive chatbot for Q&A about analysis
        
        Args:
            user_message: User's question or message
            include_context: Whether to include latest analysis context
            
        Returns:
            Dictionary with response and conversation_id
        """
        # Get context if requested
        context = getattr(self, '_last_context', None) if include_context else None
        
        # Build messages with history
        messages = [
            {
                "role": "system",
                "content": self._get_chatbot_system_prompt(context)
            }
        ]
        
        # Add conversation history (last 10 messages)
        messages.extend(self.conversation_history[-10:])
        
        # Add current message
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # Get response
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.5,
            max_tokens=1000
        )
        
        assistant_message = strip_markdown(response.choices[0].message.content)
        
        # Update history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        self.conversation_history.append({
            "role": "assistant",
            "content": assistant_message
        })
        
        return {
            "response": assistant_message,
            "conversation_id": f"conv_{len(self.conversation_history)}"
        }
    
    def clear_history(self):
        """Clear conversation history"""
        self.conversation_history = []
    
    def _build_analysis_context(
        self,
        composition: Dict[str, float],
        grade: str,
        anomaly_result: Dict,
        alloy_result: Dict
    ) -> Dict:
        """Build structured context for LLM"""
        # Both can legitimately be None — e.g. no alloy correction is
        # recommended when severity is low. Guard against that instead of
        # crashing with AttributeError on None.get(...).
        anomaly_result = anomaly_result or {}
        alloy_result = alloy_result or {}
        return {
            "composition": composition,
            "grade": grade,
            "anomaly": {
                "score": anomaly_result.get('anomaly_score', 0),
                "severity": anomaly_result.get('severity', 'UNKNOWN'),
                "confidence": anomaly_result.get('confidence', 0)
            },
            "alloy_recommendations": alloy_result.get('recommended_additions', {}),
            "alloy_confidence": alloy_result.get('confidence', 0)
        }
    
    def _get_system_prompt(self) -> str:
        """System prompt for explanation generation"""
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
        """System prompt for chatbot mode"""
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
        """Create detailed prompt for explanation generation"""
        comp = context['composition']
        grade = context['grade']
        anomaly = context['anomaly']
        recommendations = context['alloy_recommendations']
        
        prompt = f"""Analyze this foundry composition and provide a comprehensive explanation:

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
        
        return prompt
    
    def _structure_explanation(self, explanation_text: str, context: Dict) -> Dict:
        """Structure the LLM explanation into organized sections"""
        return {
            "explanation": explanation_text,
            "context": context,
            "summary": self._extract_summary(explanation_text),
            "action_items": self._extract_action_items(explanation_text),
            "risk_level": context['anomaly']['severity'],
            "confidence": context['alloy_confidence'],
            "timestamp": self._get_timestamp()
        }
    
    def _extract_summary(self, text: str) -> str:
        """Extract summary from explanation"""
        lines = text.split('\n')
        summary_lines = []
        
        for i, line in enumerate(lines):
            if 'situation summary' in line.lower():
                # Get next few non-empty lines
                for j in range(i+1, min(i+5, len(lines))):
                    if lines[j].strip() and not lines[j].startswith('#'):
                        summary_lines.append(lines[j].strip())
                break
        
        return ' '.join(summary_lines[:3]) if summary_lines else text[:200]
    
    def _extract_action_items(self, text: str) -> List[str]:
        """Extract action items from explanation"""
        lines = text.split('\n')
        actions = []
        in_action_section = False
        
        for line in lines:
            if 'operator action' in line.lower() or 'action item' in line.lower():
                in_action_section = True
                continue
            
            if in_action_section:
                if line.strip().startswith('-') or line.strip().startswith('*'):
                    actions.append(line.strip().lstrip('-*').strip())
                elif line.startswith('#'):
                    break
        
        return actions[:5]  # Top 5 action items
    
    def _get_timestamp(self) -> str:
        """Get current timestamp"""
        from datetime import datetime
        return datetime.now().isoformat()


# Singleton instance
_copilot_instance = None

def get_copilot() -> ExplainableAICopilot:
    """Get or create copilot instance"""
    global _copilot_instance
    
    if _copilot_instance is None:
        _copilot_instance = ExplainableAICopilot()
    
    return _copilot_instance
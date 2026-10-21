"""
Copilot Package
Explainable AI with Groq or Anthropic Claude LLM, and Voice Services

Set COPILOT_PROVIDER=claude in your environment to use Claude instead of
Groq for reasoning/explanations. Defaults to Groq (unchanged behavior)
if not set. Voice (STT/TTS) is configured separately — see voice_service.py.
"""
import os

from .groq_explainer import ExplainableAICopilot, get_copilot as get_groq_copilot
from .voice_service import VoiceService, get_voice_service

_PROVIDER = os.getenv("COPILOT_PROVIDER", "groq").lower()


def get_copilot():
    """
    Returns the configured copilot instance. All providers expose the
    same interface (explain_analysis, chat, clear_history), so callers
    don't need to know which one is active.
    """
    if _PROVIDER == "claude":
        from .claude_explainer import get_claude_copilot
        return get_claude_copilot()
    if _PROVIDER == "gemini":
        from .gemini_explainer import get_gemini_copilot
        return get_gemini_copilot()
    return get_groq_copilot()


__all__ = [
    'ExplainableAICopilot',
    'get_copilot',
    'VoiceService',
    'get_voice_service',
]

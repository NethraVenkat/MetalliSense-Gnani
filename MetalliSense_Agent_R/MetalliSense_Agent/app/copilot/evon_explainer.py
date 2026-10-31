"""
Gnani Evon v3.3 Integration for Explainable AI (alternative to Groq/Gemini/Claude)

Evon is served behind an OpenAI-compatible /chat/completions endpoint
(e.g. vLLM). This copilot reuses every method of ExplainableAICopilot by
giving it a tiny client adapter with the same
client.chat.completions.create(...) shape as the Groq SDK.

Enable with COPILOT_PROVIDER=evon. Env:
  EVON_BASE_URL      e.g. http://localhost:8000/v1   (empty -> mock mode)
  EVON_API_KEY       optional, sent as Authorization: Bearer ...
  EVON_MODEL         default gnani/gnani-evon-v3.3-30B-A3B
  EVON_MOCK          default true when EVON_BASE_URL is empty
  COPILOT_LANGUAGE   ta | en | auto (default auto)
"""
import os
import re
from types import SimpleNamespace
from typing import Dict, List, Optional

import requests

from .groq_explainer import ExplainableAICopilot

DEFAULT_EVON_MODEL = "gnani/gnani-evon-v3.3-30B-A3B"

MOCK_REPLY = ("Si அளவு கிரேடு வரம்பை மீறியுள்ளது, அதனால் இந்த ஹீட் HOLD நிலையில் உள்ளது. "
              "திருத்தம் மற்றும் வெளியீட்டுக்கு ஆபரேட்டர் ஒப்புதல் தேவை.")

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks (and a dangling '...</think>' prefix
    some servers emit when the opening tag is part of the chat template)."""
    if not text:
        return ""
    text = _THINK_RE.sub("", text)
    if "</think>" in text.lower():
        text = re.split(r"</think>", text, flags=re.IGNORECASE)[-1]
    return text.strip()


def _wrap(content: str):
    """Shape a reply like resp.choices[0].message.content."""
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def fold_instructions(messages):
    """llama.cpp Evon echoes system-role prompts; keep instructions in user #1.

    Copy the history: do not mutate the parent's saved conversation messages.
    """
    rules = '\n\n'.join(str(message.get('content', '')) for message in messages
                         if message.get('role') in {'system', 'developer'})
    result = [dict(message) for message in messages if message.get('role') not in {'system', 'developer'}]
    if rules:
        first = next((message for message in result if message.get('role') == 'user'), None)
        if first is None:
            result.insert(0, {'role': 'user', 'content': rules})
        else:
            first['content'] = rules + '\n\n' + str(first.get('content', ''))
    return result


class _EvonCompletions:
    def __init__(self, base_url: str, api_key: str, mock: bool, timeout: int = 120):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.mock = mock
        self.timeout = timeout

    def create(self, model: str, messages: List[Dict], temperature: float = 0.3,
               max_tokens: int = 1000, **_):
        if self.mock:
            return _wrap(MOCK_REPLY)

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        payload = {
            "model": model,
            "messages": fold_instructions(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        url = f"{self.base_url}/chat/completions"
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            if response.status_code == 400 and "chat_template_kwargs" in response.text:
                # Server doesn't accept template kwargs — retry once without them.
                payload.pop("chat_template_kwargs")
                response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        except requests.RequestException:
            raise RuntimeError("Evon unavailable") from None
        if response.status_code != 200:
            raise RuntimeError(f"Evon error {response.status_code}")

        content = response.json()["choices"][0]["message"].get("content") or ""
        return _wrap(strip_thinking(content).replace(self.api_key, '[redacted]') if self.api_key else strip_thinking(content))


class _EvonClient:
    """Mimics the Groq SDK surface: client.chat.completions.create(...)."""

    def __init__(self, base_url: str, api_key: str, mock: bool):
        self.chat = SimpleNamespace(completions=_EvonCompletions(base_url, api_key, mock))


class EvonCopilot(ExplainableAICopilot):
    """Same interface as ExplainableAICopilot, backed by Gnani Evon."""

    def __init__(self):
        # Parent __init__ is intentionally not called: it requires a Groq key.
        self.base_url = (os.getenv("EVON_BASE_URL") or "").strip()
        self.api_key = (os.getenv("EVON_API_KEY") or "").strip()
        self.model = (os.getenv("EVON_MODEL") or DEFAULT_EVON_MODEL).strip()
        self.mock = _env_bool("EVON_MOCK", default=not self.base_url)
        self.language = (os.getenv("COPILOT_LANGUAGE") or "auto").strip().lower()
        self.client = _EvonClient(self.base_url, self.api_key, self.mock)
        self.conversation_history = []
        print(f"🧠 Evon copilot: {'MOCK (no network calls)' if self.mock else self.base_url}"
              f" | model {self.model} | language {self.language}")

    def _language_rule(self) -> str:
        if self.language == "ta":
            return "- Language: reply in Tamil script."
        if self.language == "en":
            return "- Language: reply in English."
        return ("- Language: reply in the operator's language — Tamil script if they write Tamil, "
                "Tanglish if they write Tanglish, English if they write English.")

    def _evon_rules(self) -> str:
        return f"""

Additional rules (MetalliSense / Evon):
{self._language_rule()}
- Keep element symbols (Fe, C, Si, Mn, P, S), numbers and units exactly as given; never translate or convert them.
- Grounding: use ONLY numbers present in the analysis context. Never invent grade limits, alloy additions or percentages. If a value is missing, say it is "not available".
- Safety: you explain only. Approvals, stock deduction and batch release always need a human click in the console.
- Keep answers to about 4-6 sentences so they can be read aloud."""

    def _get_system_prompt(self) -> str:
        return super()._get_system_prompt() + self._evon_rules()

    def _get_chatbot_system_prompt(self, context: Optional[Dict]) -> str:
        return super()._get_chatbot_system_prompt(context) + self._evon_rules()


_evon_copilot_instance: Optional[EvonCopilot] = None


def get_evon_copilot() -> EvonCopilot:
    """Get or create the Evon copilot singleton."""
    global _evon_copilot_instance
    if _evon_copilot_instance is None:
        _evon_copilot_instance = EvonCopilot()
    return _evon_copilot_instance

"""The two LLM providers behind card generation, called over plain HTTP.

`complete_json` sends one system + user prompt and returns the reply parsed as JSON. The reply
is constrained to a JSON schema on both providers (OpenAI structured outputs, Gemini
responseJsonSchema), so it always parses, though the generator still checks every card.
Tests replace `complete_json` with a fake; nothing here runs without a real key.
"""

import json
import logging
import time
from typing import Any

import httpx2 as httpx

from .config import get_settings
from .models import Provider

log = logging.getLogger(__name__)

PROVIDER_NAMES: dict[Provider, str] = {"openai": "OpenAI", "gemini": "Gemini"}


class LlmError(Exception):
    """A call that failed. `retryable` is False when trying again can't help (a rejected key, a bad model name)."""

    def __init__(self, message: str, retryable: bool = True) -> None:
        super().__init__(message)
        self.retryable = retryable


def model_for(provider: Provider) -> str:
    settings = get_settings()
    return settings.openai_model if provider == "openai" else settings.gemini_model


def complete_json(provider: Provider, api_key: str, system: str, user: str, schema: dict[str, Any], attempts: int = 3) -> Any:
    """One call, retried on timeouts, rate limits and server errors (with backoff)."""
    for attempt in range(1, attempts + 1):
        try:
            return _call(provider, api_key, system, user, schema)
        except LlmError as e:
            if not e.retryable or attempt == attempts:
                raise
            log.warning("%s call failed (attempt %d/%d): %s", provider, attempt, attempts, e)
            time.sleep(2 * attempt * attempt)
    raise AssertionError("unreachable")


def _call(provider: Provider, api_key: str, system: str, user: str, schema: dict[str, Any]) -> Any:
    settings = get_settings()
    model = model_for(provider)
    if provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        body: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_schema", "json_schema": {"name": "trivia_cards", "strict": True, "schema": schema}},
        }
        if settings.openai_reasoning_effort:
            body["reasoning_effort"] = settings.openai_reasoning_effort
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {"x-goog-api-key": api_key}
        config: dict[str, Any] = {"responseMimeType": "application/json", "responseJsonSchema": schema}
        if settings.gemini_thinking_level:
            config["thinkingConfig"] = {"thinkingLevel": settings.gemini_thinking_level}
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": config,
        }

    name = PROVIDER_NAMES[provider]
    try:
        r = httpx.post(url, json=body, headers=headers, timeout=settings.llm_timeout_seconds)
    except httpx.TimeoutException:
        raise LlmError(f"{name} didn't answer within {settings.llm_timeout_seconds:.0f}s")
    except httpx.HTTPError as e:
        raise LlmError(f"Couldn't reach {name}: {e}")

    if r.status_code != 200:
        detail = _error_detail(r)
        if r.status_code in (401, 403):
            raise LlmError(f"{name} rejected the organization's API key ({r.status_code}): {detail}", retryable=False)
        if r.status_code in (400, 404):
            raise LlmError(f"{name} refused the request ({r.status_code}, model {model}): {detail}", retryable=False)
        raise LlmError(f"{name} error {r.status_code}: {detail}")

    data = r.json()
    try:
        if provider == "openai":
            choice = data["choices"][0]
            if choice["message"].get("refusal"):
                raise LlmError(f"{name} refused: {choice['message']['refusal']}", retryable=False)
            if choice.get("finish_reason") == "length":
                raise LlmError(f"{name} ran out of output tokens")
            text = choice["message"]["content"]
        else:
            candidate = data["candidates"][0]
            if candidate.get("finishReason") not in (None, "STOP"):
                raise LlmError(f"{name} stopped early ({candidate.get('finishReason')})")
            text = "".join(p.get("text", "") for p in candidate["content"]["parts"] if not p.get("thought"))
        return json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
        raise LlmError(f"{name} sent a reply that couldn't be read ({type(e).__name__})")


def _error_detail(r: httpx.Response) -> str:
    try:
        err = r.json().get("error")
        message = err.get("message") if isinstance(err, dict) else err
        return str(message or r.text)[:300]
    except ValueError:
        return r.text[:300]

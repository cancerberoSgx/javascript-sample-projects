"""Translating catalog keys with an LLM (rules.md I18N-8), with an organization's OpenAI or Gemini key.

One call per batch of keys (the UI sends at most MAX_KEYS at a time and shows progress). The
prompt gives every key's English message with its context (area, description, placeholders,
length hint) and, for consistent wording, some translations the language already has. Replies
are checked like a person's edit (I18N-4): invalid ones are reported, not saved.
"""

import json
from dataclasses import dataclass

from .. import llm
from ..models import I18nKey, Language, Provider
from .icu import check_translation

MAX_KEYS = 40
MAX_GLOSSARY = 60  # existing translations shown for consistency

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["translations"],
    "properties": {
        "translations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["key", "message"],
                "properties": {"key": {"type": "string"}, "message": {"type": "string"}},
            },
        }
    },
}


@dataclass
class AiResult:
    translated: dict[str, str]  # key -> message, all valid
    failed: dict[str, str]  # key -> why it wasn't usable


def system_prompt(language: Language) -> str:
    return f"""You translate the user interface of a trivia board game app from English to {language.name} ({language.native_name}, code {language.code}).
Players use it on their phones during a game, often in a group: keep it short, friendly and natural, the way a well-localized game speaks. Use the informal "you" where the language distinguishes it, unless the existing translations do otherwise.

Every message is ICU MessageFormat:
- Keep every placeholder exactly as written, e.g. {{name}}, {{count}}. Never translate or rename what is inside the braces.
- In {{x, plural, ...}}, {{x, select, ...}} and {{x, selectordinal, ...}}: keep the argument name, the keyword and the case keys (one, other, =0, AWAIT_MOVE, yes, ...) unchanged, translate only the text inside each case, and keep `#` (the number). Use the plural categories {language.name} needs (an `other` case is always required).
- Keep tags like <b>…</b> or <die>…</die> around the corresponding words. Keep line breaks (\\n), emoji and symbols (★, ⑂, →, 🏆).
- A literal apostrophe is fine as is; never add quotes around braces.

Each item has a description of where the text appears and what it means: follow it. A length hint means the text sits on a small button or label. Trivia content (questions, category names, player names) is not part of these messages.
Reply with JSON: {{"translations": [{{"key": ..., "message": ...}}]}}, one entry per key you were given."""


def user_prompt(keys: list[I18nKey], current: dict[str, str], glossary: dict[str, str]) -> str:
    items = []
    for k in keys:
        item: dict[str, object] = {"key": k.key, "english": k.source, "area": k.area, "description": k.description}
        if k.placeholders:
            item["placeholders"] = k.placeholders
        if k.max_length:
            item["max_length_hint"] = k.max_length
        if k.key in current:
            item["previous_translation"] = current[k.key]  # for an English text that changed
        items.append(item)
    parts = []
    if glossary:
        parts.append("Existing translations (keep the same wording for the same things):\n" + json.dumps(glossary, ensure_ascii=False, indent=1))
    parts.append("Translate these:\n" + json.dumps(items, ensure_ascii=False, indent=1))
    return "\n\n".join(parts)


def translate(
    provider: Provider,
    model: str,
    api_key: str,
    language: Language,
    keys: list[I18nKey],
    current: dict[str, str],
    glossary: dict[str, str],
) -> AiResult:
    reply = llm.complete_json(provider, model, api_key, system_prompt(language), user_prompt(keys, current, glossary), SCHEMA)
    wanted = {k.key: k for k in keys}
    result = AiResult(translated={}, failed={})
    for item in reply.get("translations", []) if isinstance(reply, dict) else []:
        key, message = item.get("key"), item.get("message")
        if key not in wanted or not isinstance(message, str) or not message.strip():
            continue
        errors, _ = check_translation(wanted[key].source, message)
        if errors:
            result.failed[key] = "; ".join(errors)
        else:
            result.translated[key] = message
    for key in wanted:
        if key not in result.translated and key not in result.failed:
            result.failed[key] = "The model didn't return this key"
    return result

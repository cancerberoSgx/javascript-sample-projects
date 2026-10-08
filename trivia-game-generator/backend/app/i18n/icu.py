"""A small ICU MessageFormat reader: what a message uses ({placeholders} and <tags>), and whether
it is well formed, as intl-messageformat (the frontend's formatter) reads it.

Supported: text with apostrophe quoting ('' is a quote, '{…}' is literal), simple arguments
({name}, {n, number}, {d, date, short}), plural / selectordinal (with offset: and =n keys, # inside)
and select, all of which need an `other` case, and <tag>…</tag> pairs. The browser checks the
same messages with the real parser (frontend/src/i18n/icu.ts); this is the server's guard (I18N-4).
"""

from dataclasses import dataclass, field

_SIMPLE_TYPES = {"number", "date", "time", "spellout", "ordinal", "duration"}
_PLURAL_TYPES = {"plural", "selectordinal"}
_SYNTAX = set("{}#<>'|,")


class IcuError(ValueError):
    pass


@dataclass
class MessageShape:
    args: set[str] = field(default_factory=set)
    tags: set[str] = field(default_factory=set)


def parse(message: str) -> MessageShape:
    """The placeholders and tags of `message`. Raises IcuError when it's malformed."""
    p = _Parser(message)
    p.message(in_plural=False, closing_tag=None, nested=False)
    if p.i != len(message):
        raise IcuError(f"Unexpected '{message[p.i]}' at position {p.i + 1}")
    return p.shape


def check_translation(source: str, message: str) -> tuple[list[str], list[str]]:
    """(errors, warnings) of a translation compared with its English message, like checkTranslation in icu.ts."""
    try:
        shape = parse(message)
    except IcuError as e:
        return [f"Not valid ICU MessageFormat: {e}"], []
    want = parse(source)
    errors = [f"Unknown placeholder {{{a}}}" for a in sorted(shape.args - want.args)]
    errors += [f"Unknown tag <{t}>" for t in sorted(shape.tags - want.tags)]
    warnings = [f"Leaves out {{{a}}}" for a in sorted(want.args - shape.args)]
    warnings += [f"Leaves out <{t}>" for t in sorted(want.tags - shape.tags)]
    return errors, warnings


class _Parser:
    def __init__(self, text: str) -> None:
        self.s = text
        self.i = 0
        self.shape = MessageShape()

    def peek(self, offset: int = 0) -> str:
        j = self.i + offset
        return self.s[j] if j < len(self.s) else ""

    def fail(self, what: str) -> IcuError:
        return IcuError(f"{what} at position {self.i + 1}")

    def message(self, *, in_plural: bool, closing_tag: str | None, nested: bool) -> None:
        """Reads until the end, a '}' closing a select/plural case, or `closing_tag`'s </tag>."""
        while self.i < len(self.s):
            c = self.s[self.i]
            if c == "'":
                self.apostrophe(in_plural)
            elif c == "{":
                self.argument()
            elif c == "}":
                if nested:
                    return
                raise self.fail("Unmatched '}'")
            elif c == "<" and self.peek(1) == "/":
                end = self.s.find(">", self.i)
                name = self.s[self.i + 2 : end] if end != -1 else ""
                if closing_tag is None or name != closing_tag:
                    raise self.fail(f"Unexpected closing tag </{name}>")
                self.i = end + 1
                return
            elif c == "<" and self.peek(1).isalpha():
                self.tag(in_plural)
            else:
                self.i += 1
        if closing_tag is not None:
            raise self.fail(f"Tag <{closing_tag}> is never closed")
        if nested:
            raise self.fail("Missing '}'")

    def apostrophe(self, in_plural: bool) -> None:
        nxt = self.peek(1)
        if nxt == "'":
            self.i += 2
            return
        if nxt in ("{", "}", "<", ">", "|") or (in_plural and nxt == "#"):
            self.i += 1
            while self.i < len(self.s):  # quoted literal until the next lone apostrophe
                if self.s[self.i] == "'":
                    if self.peek(1) == "'":
                        self.i += 2
                        continue
                    self.i += 1
                    return
                self.i += 1
            return  # an unclosed quote runs to the end, like intl-messageformat
        self.i += 1

    def tag(self, in_plural: bool) -> None:
        end = self.s.find(">", self.i)
        if end == -1:
            raise self.fail("Unclosed tag")
        name = self.s[self.i + 1 : end]
        if not name.replace("-", "").replace("_", "").isalnum():
            raise self.fail(f"Invalid tag <{name}>")
        self.shape.tags.add(name)
        self.i = end + 1
        self.message(in_plural=in_plural, closing_tag=name, nested=False)

    def skip_space(self) -> None:
        while self.i < len(self.s) and self.s[self.i].isspace():
            self.i += 1

    def word(self) -> str:
        start = self.i
        while self.i < len(self.s) and not self.s[self.i].isspace() and self.s[self.i] not in _SYNTAX:
            self.i += 1
        return self.s[start : self.i]

    def expect(self, ch: str) -> None:
        self.skip_space()
        if self.peek() != ch:
            raise self.fail(f"Expected '{ch}'")
        self.i += 1

    def argument(self) -> None:
        self.i += 1  # {
        self.skip_space()
        name = self.word()
        if not name:
            raise self.fail("Missing placeholder name")
        self.shape.args.add(name)
        self.skip_space()
        if self.peek() == "}":
            self.i += 1
            return
        self.expect(",")
        self.skip_space()
        kind = self.word()
        self.skip_space()
        if kind in _SIMPLE_TYPES:
            if self.peek() == ",":
                self.i += 1
                end = self.s.find("}", self.i)
                if end == -1:
                    raise self.fail("Missing '}'")
                self.i = end
            self.expect("}")
        elif kind in _PLURAL_TYPES or kind == "select":
            self.expect(",")
            self.cases(plural=kind != "select")
        else:
            raise self.fail(f"Unknown placeholder type '{kind}'")

    def cases(self, plural: bool) -> None:
        keys: set[str] = set()
        self.skip_space()
        if plural and self.s.startswith("offset:", self.i):
            self.i += len("offset:")
            self.skip_space()
            if not self.word().isdigit():
                raise self.fail("Invalid offset")
        while True:
            self.skip_space()
            if self.peek() == "}":
                self.i += 1
                break
            start = self.i
            if self.peek() == "=":
                self.i += 1
            key = self.s[start : self.i] + self.word()
            if not key or key == "=":
                raise self.fail("Missing case name")
            if key in keys:
                raise self.fail(f"Duplicate case '{key}'")
            keys.add(key)
            self.expect("{")
            self.message(in_plural=plural, closing_tag=None, nested=True)
            self.i += 1  # the case's }
        if "other" not in keys:
            raise self.fail("Missing the 'other' case")

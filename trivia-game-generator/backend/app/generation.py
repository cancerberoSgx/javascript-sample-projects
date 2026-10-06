"""Generating cards with an LLM (rules.md §2.2.1, GEN-*).

1. `plan` turns a GenerationSpec into exact counts per (category, difficulty, type) cell, so the
   requested mix is met exactly instead of being left to the model (GEN-2).
2. `plan_batches` splits each category's cells into calls of at most `generation_batch_size`
   cards. Categories run in parallel; one category's batches run one after the other, so each
   call sees the questions the previous ones wrote.
3. Every call lists the questions already used, and `Deduper` drops whatever still repeats the
   deck or the job (GEN-3). `check_card` drops malformed cards (GEN-4). Cells that come up
   short are asked for again, up to TOP_UP_ROUNDS times.
4. Cards go into the job's review list. Nothing reaches the deck until a user accepts it (GEN-6).

`runner` runs jobs on worker threads of this process. A restart marks running jobs failed.
"""

import logging
import random
import re
import threading
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Callable, Hashable, Iterable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Literal

from . import db, llm
from .config import get_settings
from .models import Category, GeneratedCard, GenerationJob, GenerationSpec, Provider
from .repositories import categories, decks, generation_jobs, organizations
from .security import decrypt_secret

log = logging.getLogger(__name__)

Kind = Literal["multiple_choice", "open"]
DIFFICULTIES: dict[int, str] = {1: "easy", 2: "medium", 3: "hard"}
KINDS: tuple[Kind, ...] = ("multiple_choice", "open")
MC_OPTIONS = 4
TOP_UP_ROUNDS = 2
MAX_AVOID_LIST = 400  # questions listed in a prompt as "already used"


@dataclass(frozen=True, order=True)
class Cell:
    category_id: int
    difficulty: int  # 1..3
    kind: Kind


# ---------- 1. exact counts (GEN-2) ----------


def largest_remainder[K: Hashable](total: int, weights: dict[K, float]) -> dict[K, int]:
    """Splits `total` in proportion to `weights` so the parts add up exactly. Ties go to the earlier key."""
    s = sum(weights.values())
    ideal = {k: total * w / s for k, w in weights.items()}
    out = {k: int(v) for k, v in ideal.items()}
    order = sorted(weights, key=lambda k: -(ideal[k] - out[k]))  # stable: keeps key order on ties
    for k in order[: total - sum(out.values())]:
        out[k] += 1
    return out


def plan(spec: GenerationSpec) -> dict[Cell, int]:
    """Cards per (category, difficulty, type).

    Each mix on its own is met exactly (largest remainder): 100 cards at 20/80 are exactly 20
    and 80. The cells start at the floor of their ideal share (count × the three shares) and the
    rest goes, one card at a time, to the cell furthest below its ideal among those whose row
    totals still have room. There's always one: if cards are left, every mix has some value left.
    """
    cat_w = {c.category_id: c.weight for c in spec.categories if c.weight > 0}
    diff_w = {d: w for d, w in zip(DIFFICULTIES, spec.difficulty.model_dump().values()) if w > 0}
    kind_w: dict[Kind, float] = {k: w for k, w in zip(KINDS, (spec.types.multiple_choice, spec.types.open)) if w > 0}
    total_c, total_d, total_k = sum(cat_w.values()), sum(diff_w.values()), sum(kind_w.values())

    ideal = {
        Cell(c, d, k): spec.count * (cw / total_c) * (dw / total_d) * (kw / total_k)
        for c, cw in cat_w.items()
        for d, dw in diff_w.items()
        for k, kw in kind_w.items()
    }
    counts = {cell: int(x) for cell, x in ideal.items()}
    # How many more cards each category / difficulty / type may still take
    room_c = Counter(largest_remainder(spec.count, cat_w))
    room_d = Counter(largest_remainder(spec.count, diff_w))
    room_k: Counter[Kind] = Counter(largest_remainder(spec.count, kind_w))
    for cell, n in counts.items():
        room_c[cell.category_id] -= n
        room_d[cell.difficulty] -= n
        room_k[cell.kind] -= n
    for _ in range(spec.count - sum(counts.values())):
        cell = max(
            (c for c in ideal if room_c[c.category_id] > 0 and room_d[c.difficulty] > 0 and room_k[c.kind] > 0),
            key=lambda c: ideal[c] - counts[c],
        )
        counts[cell] += 1
        room_c[cell.category_id] -= 1
        room_d[cell.difficulty] -= 1
        room_k[cell.kind] -= 1
    return {cell: n for cell, n in sorted(counts.items()) if n}


@dataclass
class Batch:
    category_id: int
    needs: Counter[Cell]  # cards per cell, all in this category

    @property
    def size(self) -> int:
        return sum(self.needs.values())


def plan_batches(cells: dict[Cell, int], batch_size: int) -> list[Batch]:
    """Each category's cards split into as few calls as `batch_size` allows, of even sizes
    (45 at 20 per call: 15 + 15 + 15), and each call gets the category's mix in proportion."""
    by_cat: dict[int, list[Cell]] = defaultdict(list)
    for cell, n in cells.items():
        by_cat[cell.category_id].append(cell)
    batches: list[Batch] = []
    for cat_id, cat_cells in by_cat.items():
        # Spread each cell's cards evenly along one line, then cut the line into calls
        units = sorted((((i + 0.5) / cells[c], c) for c in cat_cells for i in range(cells[c])), key=lambda u: u[0])
        n_calls = -(-len(units) // batch_size)
        start = 0
        for size in largest_remainder(len(units), dict.fromkeys(range(n_calls), 1)).values():
            batches.append(Batch(cat_id, Counter(c for _, c in units[start : start + size])))
            start += size
    return batches


# ---------- 3. duplicates (GEN-3) ----------

_STOPWORDS = frozenset(
    """a an the of in on at to for from by with and or is are was were be been being do does did
    what which who whom whose when where why how this that these those it its as into than then
    there their they he she his her you your i we our name named called known famous most
    one many much can could would should will also not""".split()
)


def normalize(text: str) -> str:
    """Lowercase, no accents, no punctuation, single spaces."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    return " ".join(re.sub(r"[^\w]+", " ", text).split())


def _tokens(question: str) -> frozenset[str]:
    words = (w[:-1] if len(w) > 3 and w.endswith("s") else w for w in normalize(question).split())
    return frozenset(w for w in words if w not in _STOPWORDS)


@dataclass
class Deduper:
    """Recognizes a question that is already in the deck or the job.

    Duplicate = same text after `normalize`; or most content words shared (Jaccard ≥ 0.8); or
    the same answer with half the content words shared ("capital of France?" / "Which city is
    France's capital?"). Rewordings that share few words can still slip through: the prompt's
    "already used" list is the first line of defense.
    """

    _texts: set[str] = field(default_factory=set)
    _entries: list[tuple[frozenset[str], str]] = field(default_factory=list)

    def is_duplicate(self, question: str, answer: str) -> bool:
        if normalize(question) in self._texts:
            return True
        tokens, ans = _tokens(question), normalize(answer)
        for other, other_ans in self._entries:
            union = len(tokens | other)
            if not union:
                continue
            j = len(tokens & other) / union
            if j >= 0.8 or (ans == other_ans and j >= 0.5):
                return True
        return False

    def add(self, question: str, answer: str) -> None:
        self._texts.add(normalize(question))
        self._entries.append((_tokens(question), normalize(answer)))

    def add_new(self, question: str, answer: str) -> bool:
        """Adds the question unless it's a duplicate. Returns whether it was added."""
        if self.is_duplicate(question, answer):
            return False
        self.add(question, answer)
        return True


# ---------- prompts and checking replies ----------

CARD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["cards"],
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["question", "type", "difficulty", "options", "answer"],
                "properties": {
                    "question": {"type": "string"},
                    "type": {"type": "string", "enum": list(KINDS)},
                    "difficulty": {"type": "string", "enum": list(DIFFICULTIES.values())},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "answer": {"type": "string"},
                },
            },
        }
    },
}

SYSTEM_PROMPT = f"""You write cards for a trivia board game. Players answer on their phones.

Every card has exactly one correct answer that is factual, unambiguous, and won't change over time.
- multiple_choice: exactly {MC_OPTIONS} distinct, plausible options; `answer` is copied character for character from `options`.
- open: `options` is []; `answer` is the short canonical answer a player would type (1 to 4 words, or a number). Answers are matched ignoring case, accents and punctuation, so avoid answers with several accepted spellings, lists, and yes/no.
- easy: most adults know it. medium: someone who follows the topic knows it. hard: experts or keen fans know it.
- Questions are self-contained, at most 200 characters, and never give away the answer.
- Never repeat or reword a question from the "Already used" list, and never ask about the same fact twice.
- Write exactly the number of cards asked for each difficulty and type. Follow the organizer's instructions when they don't conflict with these rules (they decide the language)."""


def user_prompt(category: Category, batch: Batch, deck_name: str, deck_description: str, instructions: str, avoid: list[str]) -> str:
    lines = [f'Deck: "{deck_name}"' + (f" — {deck_description}" if deck_description else "")]
    lines.append(f'Category: "{category.name}"' + (f" — {category.description}" if category.description else ""))
    if instructions:
        lines.append(f"Organizer's instructions: {instructions}")
    lines.append(f"\nWrite exactly {batch.size} cards in this category:")
    for cell, n in sorted(batch.needs.items()):
        lines.append(f"- {n} {DIFFICULTIES[cell.difficulty]} {cell.kind}")
    if avoid:
        lines.append(f"\nAlready used (don't repeat or reword), {len(avoid)} questions:")
        lines.extend(f"- {q}" for q in avoid[-MAX_AVOID_LIST:])
    return "\n".join(lines)


def check_card(raw: Any, category_id: int, rng: random.Random) -> tuple[Cell, GeneratedCard] | None:
    """A reply card as a deck card (GEN-4), or None if it can't be used. Multiple-choice options are shuffled."""
    if not isinstance(raw, dict):
        return None
    question, answer = str(raw.get("question", "")).strip(), str(raw.get("answer", "")).strip()
    kind, level = raw.get("type"), raw.get("difficulty")
    difficulty = next((d for d, name in DIFFICULTIES.items() if name == level), None)
    if not question or not answer or len(question) > 2000 or len(answer) > 2000 or difficulty is None or kind not in KINDS:
        return None
    options: list[str] | None = None
    if kind == "multiple_choice":
        options = [str(o).strip() for o in raw.get("options") or []]
        if not 2 <= len(options) <= 6 or not all(options) or any(len(o) > 2000 for o in options):
            return None
        if len({normalize(o) for o in options}) != len(options):
            return None
        match = [o for o in options if o == answer] or [o for o in options if normalize(o) == normalize(answer)]
        if len(match) != 1:
            return None  # CRD-1: the answer must be one of the options
        answer = match[0]
        rng.shuffle(options)  # models tend to put the answer in the same place
    return Cell(category_id, difficulty, kind), GeneratedCard(category_id=category_id, question=question, options=options, answer=answer, difficulty=difficulty)


# ---------- choosing a provider (GEN-1) ----------


class GenerationUnavailable(Exception):
    def __init__(self, message: str, needs_choice: bool = False) -> None:
        super().__init__(message)
        self.needs_choice = needs_choice  # both keys are set and the request didn't pick one


def available_providers(org_keys: dict[Provider, str | None]) -> list[Provider]:
    return [p for p, key in org_keys.items() if key]


def pick_provider(org_keys: dict[Provider, str | None], requested: Provider | None) -> Provider:
    available = available_providers(org_keys)
    if not available:
        raise GenerationUnavailable("This organization has no OpenAI or Gemini API key. A root user can add one on the Organizations tab.")
    if requested is None:
        if len(available) > 1:
            raise GenerationUnavailable("This organization has both an OpenAI and a Gemini key: pick a provider.", needs_choice=True)
        return available[0]
    if requested not in available:
        raise GenerationUnavailable(f"This organization has no {llm.PROVIDER_NAMES[requested]} API key.")
    return requested


def org_keys(conn: db.DbConn, organization_id: int) -> dict[Provider, str | None]:
    org = organizations.get(conn, organization_id)
    if org is None:
        return {"openai": None, "gemini": None}
    return {"openai": org.openai_api_key_encrypted, "gemini": org.gemini_api_key_encrypted}


# ---------- 4. running a job ----------


class _Stop(Exception):
    """The job was discarded or the server is shutting down."""


@dataclass
class _JobRun:
    job: GenerationJob
    api_key: str
    deck_name: str
    deck_description: str
    categories: dict[int, Category]
    deduper: Deduper
    avoid: dict[int, list[str]]  # per category: questions to list as already used
    rng: random.Random
    lock: threading.Lock = field(default_factory=threading.Lock)
    fatal: str | None = None


class Runner:
    """Runs generation jobs on this process's threads (like the WebSocket hub, one process only)."""

    def __init__(self) -> None:
        self._jobs: ThreadPoolExecutor | None = None
        self._stopping = threading.Event()

    def open(self) -> None:
        """Called on startup."""
        self._stopping = threading.Event()
        self._jobs = ThreadPoolExecutor(max_workers=4, thread_name_prefix="generation")

    def start(self, job_id: int) -> None:
        assert self._jobs, "Runner is not open"
        self._jobs.submit(self._run_safely, job_id, self._stopping)

    def shutdown(self) -> None:
        """Running jobs stop before their next call; their rows are marked failed on the next startup."""
        self._stopping.set()
        if self._jobs:
            self._jobs.shutdown(wait=False, cancel_futures=True)
            self._jobs = None

    @staticmethod
    def _run_safely(job_id: int, stopping: threading.Event) -> None:
        try:
            run_job(job_id, stopping.is_set)
        except Exception:
            log.exception("Generation job %s crashed", job_id)
            with db.connection() as conn:
                generation_jobs.finish(conn, job_id, "failed", "The generator crashed. See the server log.")


runner = Runner()


def run_job(job_id: int, stopping: Callable[[], bool] = lambda: False) -> None:
    """Runs a job to the end. Blocking; the Runner calls it on a worker thread."""
    settings = get_settings()
    with db.connection() as conn:
        job = generation_jobs.get(conn, job_id)
        if job is None or job.status != "running":
            return
        deck = decks.get(conn, job.deck_id)
        encrypted = org_keys(conn, job.organization_id)[job.provider]
        cats = {c.id: c for c in categories.list_for_org(conn, job.organization_id)}
        existing = decks.list_cards(conn, job.deck_id)
    if deck is None:
        return
    if not encrypted:
        with db.connection() as conn:
            generation_jobs.finish(conn, job_id, "failed", f"The organization's {llm.PROVIDER_NAMES[job.provider]} key was removed.")
        return

    run = _JobRun(
        job=job,
        api_key=decrypt_secret(encrypted),
        deck_name=deck.name,
        deck_description=deck.description,
        categories=cats,
        deduper=Deduper(),
        avoid=defaultdict(list),
        rng=random.Random(),
    )
    for card in existing:
        run.deduper.add(card.question, card.answer)
        run.avoid[card.category_id].append(card.question)

    cells = {cell: n for cell, n in plan(job.request).items() if cell.category_id in cats}
    batches = plan_batches(cells, settings.generation_batch_size)
    by_cat: dict[int, list[Batch]] = defaultdict(list)
    for b in batches:
        by_cat[b.category_id].append(b)

    with ThreadPoolExecutor(max_workers=max(1, settings.generation_parallel_calls), thread_name_prefix=f"generation-{job_id}") as pool:
        results = list(pool.map(lambda cat_batches: _run_category(run, cat_batches, stopping), by_cat.values()))

    with db.connection() as conn:
        latest = generation_jobs.get(conn, job_id)
        if latest is None or latest.status != "running":
            return  # discarded meanwhile
        made, wanted = len(latest.cards), sum(cells.values())
        if made < wanted and not run.fatal:
            generation_jobs.add_message(conn, job_id, f"Generated {made} of {wanted} cards: the rest kept coming back as duplicates or unusable.")
        if run.fatal and not made:
            generation_jobs.finish(conn, job_id, "failed", run.fatal)
        elif run.fatal:
            generation_jobs.finish(conn, job_id, "failed", f"Stopped after {made} of {wanted} cards: {run.fatal}")
        else:
            generation_jobs.finish(conn, job_id, "done")
    log.info("Generation job %s: %s categories, results %s", job_id, len(by_cat), results)


def _run_category(run: _JobRun, batches: list[Batch], stopping: Callable[[], bool]) -> int:
    """One category's batches, in order, then top-ups for whatever is still missing. Returns the cards made."""
    made = 0
    missing: Counter[Cell] = Counter()
    for batch in batches:
        got = _run_batch(run, batch, stopping)
        if got is None:
            return made
        made += got.total()
        missing.update(batch.needs - got)
    for _ in range(TOP_UP_ROUNDS):
        if not +missing:
            break
        top_ups = plan_batches(dict(+missing), get_settings().generation_batch_size)
        with db.connection() as conn:
            if not generation_jobs.add_batches(conn, run.job.id, len(top_ups)):
                return made
        missing = Counter()
        for batch in top_ups:
            got = _run_batch(run, batch, stopping)
            if got is None:
                return made
            made += got.total()
            missing.update(batch.needs - got)
    return made


def _run_batch(run: _JobRun, batch: Batch, stopping: Callable[[], bool]) -> Counter[Cell] | None:
    """One LLM call. Returns the cards it produced per cell, or None when the job should stop."""
    with db.connection() as conn:
        if run.fatal or stopping() or not generation_jobs.is_running(conn, run.job.id):
            return None
    category = run.categories[batch.category_id]
    with run.lock:
        avoid = list(run.avoid[category.id])
    prompt = user_prompt(category, batch, run.deck_name, run.deck_description, run.job.request.instructions, avoid)
    try:
        reply = llm.complete_json(run.job.provider, run.api_key, SYSTEM_PROMPT, prompt, CARD_SCHEMA)
    except llm.LlmError as e:
        if not e.retryable:
            run.fatal = str(e)
            return None
        with db.connection() as conn:
            generation_jobs.add_message(conn, run.job.id, f"{category.name}: a batch of {batch.size} failed ({e}).")
            generation_jobs.add_batch(conn, run.job.id, [], 0, 0)
        return Counter()

    kept: list[GeneratedCard] = []
    got: Counter[Cell] = Counter()
    duplicates = invalid = 0
    raw_cards: Iterable[Any] = reply.get("cards", []) if isinstance(reply, dict) else []
    with run.lock:
        for raw in raw_cards:
            checked = check_card(raw, category.id, run.rng)
            if checked is None:
                invalid += 1
                continue
            cell, card = checked
            if got[cell] >= batch.needs[cell]:
                continue  # more of this kind than asked for: the mix must stay exact
            if not run.deduper.add_new(card.question, card.answer):
                duplicates += 1
                continue
            run.avoid[category.id].append(card.question)
            kept.append(card)
            got[cell] += 1
    with db.connection() as conn:
        if not generation_jobs.add_batch(conn, run.job.id, kept, duplicates, invalid):
            return None
    return got

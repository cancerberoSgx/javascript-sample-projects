"""Turn engine for rules.md §3–§7: a port of engine.ts.

apply_action(state, action, now) is pure: it returns a new state (or an error) and never
changes its input. Automatic phases run inside it, so a returned state is always waiting
for input or GAME_OVER. `now` is epoch milliseconds."""

import copy
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from ..formats import DEFAULT_CONFIG
from .movement import legal_destinations
from .rng import random_int, shuffle
from .types import (
    GRAND_PRIZE,
    Action,
    AnswerResult,
    BoardDefinition,
    Card,
    DeckDefinition,
    DeckState,
    GameState,
    Message,
    MessageParams,
    Phase,
    Player,
    PlayerSetup,
    Space,
)


@dataclass(frozen=True)
class ActionOutcome:
    state: GameState
    error: str | None = None
    error_i18n: Message | None = None  # the error as a translatable message (I18N-6); `error` is its English text


@dataclass(frozen=True)
class _Failure:
    """An action the engine rejects: the English text and its translation key (I18N-6)."""

    key: str
    params: MessageParams
    text: str


def resolve_config(board: BoardDefinition) -> dict[str, Any]:
    return {**DEFAULT_CONFIG, **board["config"]}


def create_game(board: BoardDefinition, deck: DeckDefinition, players: list[PlayerSetup], seed: int, now: int) -> GameState:
    if not players:
        raise ValueError("At least one player is required")
    rng = _to_i32(seed)

    cards = {c["id"]: c for c in deck["cards"]}
    decks: dict[str, DeckState] = {}
    for category in [*(c["id"] for c in board["categories"]), GRAND_PRIZE]:
        ids = [c["id"] for c in deck["cards"] if c["category"] == category]
        draw, rng = shuffle(ids, rng)
        decks[category] = {"draw": draw, "used": []}

    s: GameState = {
        "config": resolve_config(board),
        "board": board,
        "cards": cards,
        "decks": decks,
        "players": [
            {
                "id": p.get("id", f"p{i + 1}"),
                "name": p["name"],
                "color": p["color"],
                "current_space": 0,
                "inventory": [],
                "score": 0,
                "skip_next_turn": False,
            }
            for i, p in enumerate(players)
        ],
        "active_player": 0,
        "round": 1,
        "rolls_this_turn": 0,
        "phase": "AWAIT_ROLL",
        "last_roll": None,
        "destinations": {},
        "last_move": None,
        "question": None,
        "last_answer": None,
        "result": None,
        "rng": rng,
        "log": [],
    }
    _log(s, "log.gameStarted", {"board": board["name"], "count": len(players)}, f'Game started on "{board["name"]}" with {len(players)} player(s).', None)
    _start_turn(s, now)
    return s


def apply_action(state: GameState, action: Action, now: int) -> ActionOutcome:
    if state["phase"] == "GAME_OVER":
        return _failed(state, _Failure("engine.gameOver", {}, "The game is over (INV-4)."))
    s = copy.deepcopy(state)
    error = _dispatch(s, action, now)
    return _failed(state, error) if error else ActionOutcome(s)


def _failed(state: GameState, f: _Failure) -> ActionOutcome:
    return ActionOutcome(state, f.text, {"key": f.key, "params": f.params})


def active_player(s: GameState) -> Player:
    return s["players"][s["active_player"]]


def public_view(s: GameState) -> dict[str, Any]:
    """What players see (MPL-6): no cards, draw piles or RNG, and the pending card without its answer."""
    view: dict[str, Any] = {k: v for k, v in s.items() if k not in ("cards", "decks", "rng")}
    if (q := s["question"]) is not None:
        view["question"] = {**q, "card": {k: v for k, v in q["card"].items() if k != "correct_answer"}}
    return view


# ---------------------------------------------------------------------------


def _to_i32(x: int) -> int:
    x &= 0xFFFFFFFF
    return x - 0x1_0000_0000 if x & 0x8000_0000 else x


def _space_at(s: GameState, index: int) -> Space:
    return next(sp for sp in s["board"]["spaces"] if sp["index"] == index)


def _category_name(s: GameState, cat_id: str) -> str:
    if cat_id == GRAND_PRIZE:
        return "Grand Prize"
    return next((c["name"] for c in s["board"]["categories"] if c["id"] == cat_id), cat_id)


def _js_str(value: Any) -> str:
    """String(value) as JavaScript writes it (for the values an answer can be)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _dispatch(s: GameState, action: Action, now: int) -> _Failure | None:
    kind = action.get("type")

    def expect(phase: Phase) -> _Failure | None:
        if s["phase"] == phase:
            return None
        return _Failure("engine.wrongPhase", {"action": _js_str(kind), "phase": s["phase"]}, f"Can't {kind} now: waiting for {s['phase']} (SM-1).")

    match kind:
        case "ROLL":
            if bad := expect("AWAIT_ROLL"):
                return bad
            value = action.get("value")
            sides = s["config"]["dice_sides"]
            if value is None:
                value, s["rng"] = random_int(s["rng"], 1, sides)
            elif not isinstance(value, int) or isinstance(value, bool) or value < 1 or value > sides:
                return _Failure("engine.rollRange", {"sides": sides}, f"Roll must be between 1 and {sides}.")
            s["rolls_this_turn"] += 1
            s["last_roll"] = value
            s["destinations"] = legal_destinations(s["board"]["spaces"], active_player(s)["current_space"], value)
            s["phase"] = "AWAIT_MOVE"
            rigged = action.get("value") is not None
            options = ", ".join(s["destinations"])
            params: MessageParams = {"value": value, "rigged": "yes" if rigged else "no", "options": options}
            _log(s, "log.rolled", params, f"rolled a {value}{' (rigged)' if rigged else ''}. Can move to: {options}.")
            return None

        case "MOVE":
            if bad := expect("AWAIT_MOVE"):
                return bad
            to = action.get("to")
            path = s["destinations"].get(_js_str(to))
            if path is None:
                legal = ", ".join(s["destinations"])
                roll = s["last_roll"]
                return _Failure(
                    "engine.unreachable",
                    {"space": to, "roll": roll if roll is not None else 0, "legal": legal},  # pyright: ignore[reportArgumentType]
                    f"Space {_js_str(to)} can't be reached with a roll of {_js_str(roll) if roll is not None else 'null'}. Legal: {legal}.",
                )
            p = active_player(s)
            seq = (s["last_move"]["seq"] if s["last_move"] else 0) + 1
            s["last_move"] = {"seq": seq, "player_id": p["id"], "path": [p["current_space"], *path]}
            p["current_space"] = int(to)  # pyright: ignore[reportArgumentType]
            s["destinations"] = {}
            joined = " → ".join(str(i) for i in path)
            _log(s, "log.moved", {"path": joined}, f"moved along {joined}.")
            _resolve_space(s, now)
            return None

        case "CHOOSE_CATEGORY":
            if bad := expect("AWAIT_CATEGORY"):
                return bad
            category = action.get("category")
            if not any(c["id"] == category for c in s["board"]["categories"]):
                return _Failure("engine.unknownCategory", {"category": category}, f"Unknown category '{_js_str(category)}'.")  # pyright: ignore[reportArgumentType]
            assert isinstance(category, str)
            _log(s, "log.choseCategory", {"category": category}, f"chose {_category_name(s, category)} on the wildcard.")
            _draw_card(s, category, grand_prize=False, from_hq=False, now=now)
            return None

        case "ANSWER":
            if bad := expect("AWAIT_ANSWER"):
                return bad
            q = s["question"]
            assert q is not None
            answer = action.get("answer")
            late = q["deadline"] is not None and now > q["deadline"]
            result: AnswerResult = "timeout" if late else "correct" if _is_correct(q["card"], answer) else "incorrect"
            options = q["card"]["options"]
            given = _js_str(answer)
            if options and isinstance(answer, int) and not isinstance(answer, bool):
                given = options[answer] if 0 <= answer < len(options) else given
            _apply_result(s, result, given, now)
            return None

        case "TIMEOUT":
            if bad := expect("AWAIT_ANSWER"):
                return bad
            q = s["question"]
            assert q is not None
            if q["deadline"] is None or now < q["deadline"]:
                return _Failure("engine.timerRunning", {}, "The timer hasn't expired yet.")
            _apply_result(s, "timeout", "", now)
            return None

        case "FORCE_RESULT":
            if bad := expect("AWAIT_ANSWER"):
                return bad
            correct = bool(action.get("correct"))
            _apply_result(s, "correct" if correct else "incorrect", "(forced correct)" if correct else "(forced wrong)", now)
            return None

        case "SKIP_TURN":
            _log(s, "log.skippedByHost", {}, "had their turn skipped by the host.")
            _end_turn(s, now)
            return None

        case "REMOVE_PLAYER":
            p = next((x for x in s["players"] if x["id"] == action.get("player_id")), None)
            if p is None or p.get("removed"):
                player = action.get("player_id")
                return _Failure("engine.unknownPlayer", {"player": player}, f"Unknown player '{_js_str(player)}'.")  # pyright: ignore[reportArgumentType]
            if sum(not x.get("removed") for x in s["players"]) == 1:
                return _Failure("engine.lastPlayer", {}, "Can't remove the last player: finish the game instead.")
            p["removed"] = True
            p["skip_next_turn"] = False
            _log(s, "log.removedByHost", {}, "was removed from the game by the host.", p["id"])
            if p is active_player(s):
                _end_turn(s, now)
            return None

    return _Failure("engine.unknownAction", {"action": _js_str(kind)}, f"Unknown action '{_js_str(kind)}'.")


# §4.1 TURN_START
def _start_turn(s: GameState, now: int) -> None:
    s["rolls_this_turn"] = 0
    s["last_roll"] = None
    s["destinations"] = {}
    s["question"] = None
    p = active_player(s)

    if p["skip_next_turn"]:
        p["skip_next_turn"] = False  # TS-2 / PEN-2
        _log(s, "log.skipsPenalty", {}, "skips this turn (penalty).")
        _end_turn(s, now)
        return
    if s["config"]["track_type"] == "linear" and _space_at(s, p["current_space"])["type"] == "finish":
        _log(s, "log.stillOnFinish", {}, "is still on the finish space and tries another Grand Prize question (TS-3).")
        _draw_card(s, GRAND_PRIZE, grand_prize=True, from_hq=False, now=now)
        return
    s["phase"] = "AWAIT_ROLL"


# §4.4 RESOLVE_SPACE
def _resolve_space(s: GameState, now: int) -> None:
    p = active_player(s)
    space = _space_at(s, p["current_space"])
    match space["type"]:
        case "start":
            _log(s, "log.landedStart", {}, "landed on Start. No card.")
            _end_turn(s, now)
        case "category" | "hq":
            assert space["category"] is not None
            _draw_card(s, space["category"], grand_prize=False, from_hq=space["type"] == "hq", now=now)
        case "wildcard":
            _log(s, "log.landedWildcard", {}, "landed on a Wildcard and picks a category.")
            s["phase"] = "AWAIT_CATEGORY"
        case "roll_again":
            limit = s["config"]["max_rolls_per_turn"]
            if s["rolls_this_turn"] < limit:
                _log(s, "log.landedRollAgain", {}, "landed on Roll Again.")
                s["phase"] = "AWAIT_ROLL"
                return
            _log(s, "log.rollAgainUsedUp", {"limit": limit}, f"landed on Roll Again but already used {limit} rolls this turn.")
            _end_turn(s, now)
        case "penalty":
            p["skip_next_turn"] = True  # PEN-1
            _log(s, "log.landedPenalty", {}, "landed on a Penalty space and will skip their next turn.")
            _end_turn(s, now)
        case "finish":
            _log(s, "log.reachedFinish", {}, "reached the finish and gets a Grand Prize question!")
            _draw_card(s, GRAND_PRIZE, grand_prize=True, from_hq=False, now=now)


# §4.5 DRAW_CARD (CRD-2, CRD-3)
def _draw_card(s: GameState, category: str, *, grand_prize: bool, from_hq: bool, now: int) -> None:
    deck = s["decks"][category]
    if s["config"]["reuse_cards"]:
        pool = [*deck["draw"], *deck["used"]]
        i, s["rng"] = random_int(s["rng"], 0, len(pool) - 1)
        card_id = pool[i]
    else:
        if not deck["draw"]:
            deck["draw"], s["rng"] = shuffle(deck["used"], s["rng"])
            deck["used"] = []
            _log(s, "log.deckReshuffled", {"category": category}, f"{_category_name(s, category)} deck ran out and was reshuffled.", None)
        card_id = deck["draw"].pop(0)
        deck["used"].append(card_id)
    limit = s["config"]["answer_time_limit_sec"]
    s["question"] = {
        "card": s["cards"][card_id],
        "deadline": now + limit * 1000 if limit > 0 else None,
        "grand_prize": grand_prize,
        "from_hq": from_hq,
    }
    s["phase"] = "AWAIT_ANSWER"


# §4.6 EVALUATE (EVL-1, EVL-2)
_COMBINING = re.compile("[̀-ͯ]")
_SPACES = re.compile(r"\s+")


def normalize_answer(text: str) -> str:
    t = _COMBINING.sub("", unicodedata.normalize("NFD", text)).lower()
    t = "".join(ch for ch in t if unicodedata.category(ch)[0] in "LN" or ch.isspace())
    return _SPACES.sub(" ", t).strip()


def _is_correct(card: Card, answer: Any) -> bool:
    if card["options"]:
        return type(answer) is type(card["correct_answer"]) and answer == card["correct_answer"]
    return normalize_answer(_js_str(answer)) == normalize_answer(_js_str(card["correct_answer"]))


# §4.7 APPLY_RESULT
def _apply_result(s: GameState, result: AnswerResult, given: str, now: int) -> None:
    q = s["question"]
    assert q is not None
    p = active_player(s)
    card = q["card"]
    s["last_answer"] = {"card": card, "given": given, "result": result}
    s["question"] = None

    if result != "correct":
        if result == "timeout":
            _log(s, "log.timeout", {}, "ran out of time.")
        else:
            _log(s, "log.answeredWrong", {"given": given}, f"answered wrong ({given}).")
        _end_turn(s, now)  # RES-6
        return

    p["score"] += card["difficulty"]  # RES-1
    _log(s, "log.answeredCorrectly", {"points": card["difficulty"]}, f"answered correctly (+{card['difficulty']}).")
    if q["from_hq"] and card["category"] not in p["inventory"]:
        p["inventory"] = sorted([*p["inventory"], card["category"]])  # RES-2, PLY-2
        _log(s, "log.earnedToken", {"category": card["category"]}, f"earned the {_category_name(s, card['category'])} token!")

    # RES-3 / RES-4: check for a win before any bonus roll
    wins = s["config"]["win_conditions"]
    if q["grand_prize"] and "finish" in wins:
        return _win(s, p, "finish")
    if "collection" in wins and all(c["id"] in p["inventory"] for c in s["board"]["categories"]):
        return _win(s, p, "collection")

    # RES-5
    if s["config"]["bonus_roll_on_correct"] and s["rolls_this_turn"] < s["config"]["max_rolls_per_turn"]:
        _log(s, "log.bonusRoll", {}, "gets a bonus roll.")
        s["phase"] = "AWAIT_ROLL"
        return
    _end_turn(s, now)


# §4.8 TURN_END. Removed players are passed over (MPL-9).
def _end_turn(s: GameState, now: int) -> None:
    s["question"] = None
    s["destinations"] = {}
    while True:
        s["active_player"] = (s["active_player"] + 1) % len(s["players"])
        if s["active_player"] == 0:
            s["round"] += 1
            max_rounds = s["config"]["max_rounds"]
            if "turn_limit" in s["config"]["win_conditions"] and max_rounds and s["round"] > max_rounds:
                return _finish_by_turn_limit(s)
        if not active_player(s).get("removed"):
            break
    _start_turn(s, now)


# §7.3 (WIN-T1, WIN-T2)
def _finish_by_turn_limit(s: GameState) -> None:
    def key(p: Player) -> tuple[int, int, int]:
        return (p["score"], len(p["inventory"]), p["current_space"])

    ranked = sorted((p for p in s["players"] if not p.get("removed")), key=lambda p: tuple(-k for k in key(p)))
    s["round"] = s["config"]["max_rounds"]
    if len(ranked) > 1 and key(ranked[0]) == key(ranked[1]):
        s["result"] = {"type": "draw"}
        s["phase"] = "GAME_OVER"
        _log(s, "log.draw", {}, "Round limit reached. It's a draw!", None)
        return
    _win(s, ranked[0], "turn_limit")


_WHY = {"finish": "answered the Grand Prize", "collection": "collected every category", "turn_limit": "had the best score at the round limit"}


def _win(s: GameState, p: Player, reason: str) -> None:
    s["result"] = {"type": "win", "player_id": p["id"], "reason": reason}
    s["phase"] = "GAME_OVER"
    _log(s, "log.wins", {"reason": reason}, f"WINS: {_WHY[reason]}!", p["id"])


_DEFAULT = object()


def _log(s: GameState, key: str, params: MessageParams, text: str, player_id: Any = _DEFAULT) -> None:
    """Adds a log line: its English text, and its key and params for translating it (I18N-6)."""
    pid = active_player(s)["id"] if player_id is _DEFAULT else player_id
    s["log"].append({"round": s["round"], "player_id": pid, "text": text, "key": key, "params": params})

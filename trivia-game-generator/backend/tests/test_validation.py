"""Board validation (app/validation.py) against the TypeScript validator it was ported from.

fixtures/board_validation.json is written by frontend/src/engine/board.test.ts: example and
broken boards with the issues validateBoardFile found. validate_board must find the same ones."""

import json
from pathlib import Path

import pytest

from app.formats import BoardDefinition
from app.validation import validate_board

CASES = json.loads((Path(__file__).parent / "fixtures" / "board_validation.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_same_issues_as_typescript(case):
    board = BoardDefinition.model_validate({k: case["board"][k] for k in ("config", "slots", "spaces")})
    assert [i.model_dump() for i in validate_board(board)] == case["issues"]

"""Generates seeds/0002_example_content.sql from frontend/public/{boards,decks}.

Run from backend/:  python scripts/generate_example_seed.py
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUB = f"{ROOT}/frontend/public"
q = lambda v: "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
js = lambda v: "NULL" if v is None else q(json.dumps(v, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"

deck = json.load(open(f"{PUB}/decks/general.json"))
boards = [json.load(open(p)) for p in sorted(glob.glob(f"{PUB}/boards/*.json")) if not p.endswith("index.json")]
order = {b["file"]: i for i, b in enumerate(json.load(open(f"{PUB}/boards/index.json"))["boards"])}
boards.sort(key=lambda b: order[f"boards/{b['id']}.json"])
cat_name = {c["id"]: c["name"] for c in deck["categories"]}

out = [
    "-- seed 0002: example categories, deck, boards and a game for the 'Default' organization",
    "-- Generated from frontend/public/boards/*.json and frontend/public/decks/general.json.",
    "-- Safe to re-run: rows that already exist (same name) are skipped. Does nothing if 'Default' doesn't exist.",
    "",
    "-- Categories",
    "INSERT INTO trivia_categories (organization_id, name, description, color)",
    "SELECT o.id, v.name, v.description, v.color",
    "FROM trivia_organizations o, (VALUES",
    ",\n".join(f"    ({q(c['name'])}, {q(c['description'])}, {q(c['color'])})" for c in deck["categories"]),
    ") AS v (name, description, color)",
    "WHERE o.name = 'Default'",
    "ON CONFLICT DO NOTHING;",
    "",
    "-- Deck + cards (cards are only added when the deck is new)",
    "WITH org AS (SELECT id FROM trivia_organizations WHERE name = 'Default'),",
    "deck AS (",
    "    INSERT INTO trivia_decks (organization_id, name, description)",
    f"    SELECT id, {q(deck['name'])}, {q(deck['description'])} FROM org",
    "    ON CONFLICT DO NOTHING",
    "    RETURNING id, organization_id",
    ")",
    "INSERT INTO trivia_cards (deck_id, category_id, question, options, answer, difficulty, grand_prize, position)",
    "SELECT deck.id, c.id, v.question, v.options, v.answer, v.difficulty, v.grand_prize, v.position",
    "FROM deck",
    "CROSS JOIN (VALUES",
    ",\n".join(
        f"    ({q(cat_name[c['category']])}, {q(c['question'])}, {js(c['options'])}, {q(c['answer'])}, {c['difficulty']}, {str(c['grand_prize']).lower()}, {i})"
        for i, c in enumerate(deck["cards"])
    ),
    ") AS v (category, question, options, answer, difficulty, grand_prize, position)",
    "JOIN trivia_categories c ON c.organization_id = deck.organization_id AND c.name = v.category;",
    "",
    "-- Boards (definition = config + slots + spaces)",
    "INSERT INTO trivia_boards (organization_id, name, description, definition)",
    "SELECT o.id, v.name, v.description, v.definition",
    "FROM trivia_organizations o, (VALUES",
    ",\n".join(
        f"    ({q(b['name'])}, {q(b['description'])}, {js({'config': b['config'], 'slots': b['slots'], 'spaces': b['spaces']})})"
        for b in boards
    ),
    ") AS v (name, description, definition)",
    "WHERE o.name = 'Default'",
    "ON CONFLICT DO NOTHING;",
    "",
    "-- A game ready to start: Forked Paths + the sample deck, slots A-D = the four categories",
    "WITH org AS (SELECT id FROM trivia_organizations WHERE name = 'Default'),",
    "game AS (",
    "    INSERT INTO trivia_games (organization_id, name, creator_id, board_id, deck_id)",
    "    SELECT org.id, 'Friday Quiz Night',",
    "           (SELECT id FROM trivia_users WHERE organization_id = org.id AND role = 'root' ORDER BY id LIMIT 1),",
    "           (SELECT id FROM trivia_boards WHERE organization_id = org.id AND name = 'Forked Paths'),",
    f"           (SELECT id FROM trivia_decks WHERE organization_id = org.id AND name = {q(deck['name'])})",
    "    FROM org",
    "    WHERE NOT EXISTS (SELECT 1 FROM trivia_games g WHERE g.organization_id = org.id AND g.name = 'Friday Quiz Night')",
    "    RETURNING id, organization_id",
    "),",
    "mapping AS (",
    "    INSERT INTO trivia_game_categories (game_id, slot, category_id)",
    "    SELECT game.id, v.slot, c.id",
    "    FROM game",
    "    CROSS JOIN (VALUES " + ", ".join(f"({q(s)}, {q(deck['categories'][i]['name'])})" for i, s in enumerate(['A','B','C','D'])) + ") AS v (slot, category)",
    "    JOIN trivia_categories c ON c.organization_id = game.organization_id AND c.name = v.category",
    ")",
    "INSERT INTO trivia_players (game_id, name, position)",
    "SELECT game.id, v.name, v.position FROM game",
    "CROSS JOIN (VALUES ('Ana', 0), ('Ben', 1), ('Cleo', 2)) AS v (name, position);",
    "",
]
open(f"{ROOT}/backend/seeds/0002_example_content.sql", "w").write("\n".join(out))
print("ok")

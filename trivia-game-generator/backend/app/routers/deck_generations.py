"""Saved deck generations (rules.md §2.2.2, GEN-8 … GEN-10): named settings of the generate form,
kept on a deck so they can be loaded again, refined and reused. Anyone who can edit the deck can
manage them. Their categories are the organization's, so any deck of it can load them."""

from fastapi import APIRouter, HTTPException, Response, status
from psycopg import errors

from ..auth import Conn, CurrentUser, Me
from ..db import DbConn
from ..models import (
    Deck,
    DeckGeneration,
    DeckGenerationChanges,
    GenerationSettings,
    NewDeckGeneration,
)
from ..permissions import conflict, list_org, not_found, visible
from ..repositories import categories, deck_generations, decks
from ..schemas import DeckGenerationIn, DeckGenerationOut, DeckGenerationUpdate

router = APIRouter(tags=["deck generations"])


def _out(generation: DeckGeneration | None) -> DeckGenerationOut:
    if generation is None:
        raise not_found("Saved generation not found")
    return DeckGenerationOut(**generation.model_dump())


def _deck(me: CurrentUser, conn: DbConn, deck_id: int) -> Deck:
    return visible(me, decks.get(conn, deck_id), "Deck")


def check_categories(conn: DbConn, organization_id: int, spec: GenerationSettings) -> None:
    """Every share names one of the organization's categories."""
    ids = [s.category_id for s in spec.categories]
    found = {c.id for c in categories.get_many(conn, ids) if c.organization_id == organization_id}
    if any(i not in found for i in ids):
        raise not_found("Category not found in this deck's organization")


def _taken(name: str) -> HTTPException:
    return conflict(f"This deck already has a saved generation named '{name}'")


@router.get("/api/deck-generations", response_model=list[DeckGenerationOut])
def list_org_generations(me: Me, conn: Conn, organization_id: int | None = None):
    """Every saved generation of the organization's decks, to load into any of them (GEN-8)."""
    return [_out(g) for g in deck_generations.list_for_org(conn, list_org(me, organization_id))]


@router.get("/api/decks/{deck_id}/generations", response_model=list[DeckGenerationOut])
def list_deck_generations(deck_id: int, me: Me, conn: Conn):
    _deck(me, conn, deck_id)
    return [_out(g) for g in deck_generations.list_for_deck(conn, deck_id)]


@router.post("/api/decks/{deck_id}/generations", response_model=DeckGenerationOut, status_code=status.HTTP_201_CREATED)
def create_deck_generation(deck_id: int, body: DeckGenerationIn, me: Me, conn: Conn):
    deck = _deck(me, conn, deck_id)
    check_categories(conn, deck.organization_id, body.spec)
    new = NewDeckGeneration(
        deck_id=deck_id,
        name=body.name,
        description=body.description,
        provider=body.provider,
        spec=GenerationSettings(**body.spec.model_dump()),
        creator_id=me.id,
    )
    try:
        with conn.transaction():
            new_id = deck_generations.create(conn, new)
    except errors.UniqueViolation:
        raise _taken(body.name)
    return _out(deck_generations.get(conn, new_id))


def _visible_generation(me: CurrentUser, conn: DbConn, deck_id: int, generation_id: int) -> tuple[Deck, DeckGeneration]:
    deck = _deck(me, conn, deck_id)
    generation = deck_generations.get(conn, generation_id)
    if generation is None or generation.deck_id != deck_id:
        raise not_found("Saved generation not found")
    return deck, generation


@router.get("/api/decks/{deck_id}/generations/{generation_id}", response_model=DeckGenerationOut)
def get_deck_generation(deck_id: int, generation_id: int, me: Me, conn: Conn):
    return _out(_visible_generation(me, conn, deck_id, generation_id)[1])


@router.patch("/api/decks/{deck_id}/generations/{generation_id}", response_model=DeckGenerationOut)
def update_deck_generation(deck_id: int, generation_id: int, body: DeckGenerationUpdate, me: Me, conn: Conn):
    deck, _ = _visible_generation(me, conn, deck_id, generation_id)
    sent = body.model_dump(exclude_unset=True)
    if body.spec is not None:
        check_categories(conn, deck.organization_id, body.spec)
    changes = DeckGenerationChanges(**{k: v for k, v in sent.items() if v is not None or k == "provider"})
    try:
        with conn.transaction():
            deck_generations.update(conn, generation_id, changes)
    except errors.UniqueViolation:
        raise _taken(body.name or "")
    return _out(deck_generations.get(conn, generation_id))


@router.delete("/api/decks/{deck_id}/generations/{generation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck_generation(deck_id: int, generation_id: int, me: Me, conn: Conn):
    """Its past generations stay as they were; they just no longer point to it."""
    _visible_generation(me, conn, deck_id, generation_id)
    with conn.transaction():
        deck_generations.delete(conn, generation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

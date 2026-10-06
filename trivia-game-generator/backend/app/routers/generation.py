"""Generating a deck's cards with OpenAI or Gemini (rules.md §2.2.1, GEN-*).

A deck has at most one generation under review. It runs in the background (app/generation.py);
the UI polls GET until it's done, lets the user review the cards, then accepts or discards it.
"""

from fastapi import APIRouter, HTTPException, Response, status
from psycopg import errors

from .. import generation, llm
from ..auth import Conn, CurrentUser, Me
from ..config import get_settings
from ..db import DbConn
from ..models import Deck, GenerationJob, GenerationSpec, NewCard, NewGenerationJob
from ..permissions import conflict, not_found, visible
from ..repositories import categories, decks, generation_jobs
from ..schemas import (
    GenerationAccept,
    GenerationAcceptOut,
    GenerationJobOut,
    GenerationRequest,
    ProviderOut,
)

router = APIRouter(prefix="/api/decks/{deck_id}/generation", tags=["generation"])


def _deck(me: CurrentUser, conn: DbConn, deck_id: int) -> Deck:
    return visible(me, decks.get(conn, deck_id), "Deck")


def _out(job: GenerationJob | None) -> GenerationJobOut:
    if job is None:
        raise not_found("Generation not found")
    return GenerationJobOut(**job.model_dump())


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(deck_id: int, me: Me, conn: Conn):
    """The providers this deck's organization has a key for (GEN-1). Empty: generating isn't possible."""
    deck = _deck(me, conn, deck_id)
    keys = generation.org_keys(conn, deck.organization_id)
    available = generation.available_providers(keys)
    return [ProviderOut(id=p, name=llm.PROVIDER_NAMES[p], model=generation.org_model(conn, deck.organization_id, p)) for p in available]


@router.get("", response_model=GenerationJobOut | None)
def get_generation(deck_id: int, me: Me, conn: Conn):
    """The deck's generation that is running or waiting for review, or null."""
    _deck(me, conn, deck_id)
    job = generation_jobs.get_open(conn, deck_id)
    return _out(job) if job else None


@router.post("", response_model=GenerationJobOut, status_code=status.HTTP_201_CREATED)
def start_generation(deck_id: int, body: GenerationRequest, me: Me, conn: Conn):
    deck = _deck(me, conn, deck_id)
    for share in body.categories:
        category = categories.get(conn, share.category_id)
        if category is None or category.organization_id != deck.organization_id:
            raise not_found("Category not found in this deck's organization")
    try:
        provider = generation.pick_provider(generation.org_keys(conn, deck.organization_id), body.provider)
    except generation.GenerationUnavailable as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT if e.needs_choice else status.HTTP_409_CONFLICT, str(e))

    spec = GenerationSpec(**body.model_dump(exclude={"provider"}))
    batches = generation.plan_batches(generation.plan(spec), get_settings().generation_batch_size)
    new = NewGenerationJob(deck_id=deck_id, creator_id=me.id, provider=provider, model=generation.org_model(conn, deck.organization_id, provider), request=spec)
    try:
        with conn.transaction():
            job_id = generation_jobs.create(conn, new, len(batches))
    except errors.UniqueViolation:
        raise conflict("This deck already has generated cards waiting for review. Add them or discard them first.")
    generation.runner.start(job_id)
    return _out(generation_jobs.get(conn, job_id))


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def discard_generation(deck_id: int, me: Me, conn: Conn):
    """Throws the generated cards away. A running job stops after its current calls."""
    _deck(me, conn, deck_id)
    job = generation_jobs.get_open(conn, deck_id)
    if job is None:
        raise not_found("Generation not found")
    with conn.transaction():
        generation_jobs.delete(conn, job.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/accept", response_model=GenerationAcceptOut)
def accept_generation(deck_id: int, body: GenerationAccept, me: Me, conn: Conn):
    """GEN-6: adds the reviewed cards (possibly edited, possibly fewer) to the deck."""
    deck = _deck(me, conn, deck_id)
    job = generation_jobs.get_open(conn, deck_id)
    if job is None or job.id != body.job_id:
        raise not_found("Generation not found. It may have been discarded or already added.")
    if job.status == "running":
        raise conflict("Still generating. Wait for it to finish, or discard it.")
    for category_id in {c.category_id for c in body.cards}:
        category = categories.get(conn, category_id)
        if category is None or category.organization_id != deck.organization_id:
            raise not_found("Category not found in this deck's organization")

    # GEN-3 again: the deck may have changed while the cards were under review, and edits may collide
    seen = generation.Deduper()
    for card in decks.list_cards(conn, deck_id):
        seen.add(card.question, card.answer)
    skipped: list[str] = []
    with conn.transaction():
        if not generation_jobs.mark_accepted(conn, job.id):
            raise conflict("This generation was just accepted or discarded elsewhere.")
        added = 0
        for card in body.cards:
            if not seen.add_new(card.question, card.answer):
                skipped.append(card.question)
                continue
            decks.create_card(conn, NewCard(deck_id=deck_id, **card.model_dump()))
            added += 1
    return GenerationAcceptOut(added=added, skipped_duplicates=skipped)

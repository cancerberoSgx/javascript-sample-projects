# Backend API integration tests

These tests exercise the FastAPI app through `TestClient` against the real
Postgres database selected by `DATABASE_URL`. They are not mocked and they do not
use a separate schema.

Each run:

1. Enters the app lifespan, which applies pending SQL migrations.
2. Logs in as the seed root user.
3. Creates uniquely named organizations, users, drives, folders, and files.
4. Asserts API responses, validation, permissions, and binary/text behavior.
5. Deletes every organization it created in fixture teardown. A direct SQL
   cleanup is the fallback if an API deletion fails.

## Run with Docker (recommended)

From the project root:

```bash
cd docker
docker compose --profile test run --rm backend-tests
```

This starts the existing `db` service, builds `Dockerfile.test`, and runs pytest
inside the backend image. It uses the same Postgres volume as the app. The tests
remove their own organizations, but use a disposable development database rather
than a production database.

Useful variants:

```bash
docker compose --profile test run --rm backend-tests pytest -q -x
docker compose --profile test run --rm backend-tests pytest -q -m integration
docker compose --profile test run --rm backend-tests pytest -q -k drives
```

## Run locally

Start Postgres first, then:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

export DATABASE_URL=postgresql+psycopg://app:app@localhost:5433/app
export JWT_SECRET=dev-secret-change-me
export TEST_ROOT_EMAIL=root@example.com
export TEST_ROOT_PASSWORD=admin123

pytest -q
```

If Postgres is exposed somewhere else, adjust `DATABASE_URL`. The root account
comes from migration `002_seed_root.sql`; override `TEST_ROOT_EMAIL` and
`TEST_ROOT_PASSWORD` if you changed it.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://app:app@localhost:5432/app` | Database used by the app and tests |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret |
| `TEST_ROOT_EMAIL` | `root@example.com` | Root account used to bootstrap test data |
| `TEST_ROOT_PASSWORD` | `admin123` | Password for the root account |

## Fixtures and helpers

`conftest.py` provides a session-scoped `api` fixture:

```python
def test_new_endpoint(api):
    organization = api.create_organization("example")
    member, member_token = api.create_member(organization["id"])

    response = api.client.get(
        f"/api/organizations/{organization['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
```

Available helpers:

- `api.client` — `TestClient` for the FastAPI app.
- `api.headers(token=None)` — auth header; defaults to the root token.
- `api.login(email, password)` — login and return the token response.
- `api.create_organization(label)` — create a unique test organization and track it for cleanup.
- `api.create_user(organization_id, label=..., role=..., token=...)` — create a user.
- `api.create_member(organization_id, label=...)` — create a member and return `(user, token)`.
- `api.create_drive(organization_id, name=..., token=...)` — create a drive.
- `api.create_folder(...)` / `api.create_file(...)` — create drive items.

## Adding tests for a new feature

Use this checklist for every new endpoint or behavior:

1. Add the test to this directory and keep `pytestmark = pytest.mark.integration`.
2. Use the `api` fixture. Create a fresh organization (or user/drive) for the
   test instead of relying on the root organization or fixed IDs.
3. Use unique names through the helpers. Never clean up by deleting broad
   patterns; let the tracked organization teardown handle cleanup.
4. Assert the success path: status code, response fields, persisted values, and
   list/get behavior after a mutation.
5. Assert validation failures (`400`, `409`, `422`) and authentication or
   permission failures (`401`, `403`) for every protected operation.
6. For cross-organization rules, create a second organization and a member in it,
   then verify the member cannot read or mutate the first organization.
7. For uploads, use multipart form data and compare downloaded bytes exactly.
   For text files, also verify the detail endpoint returns `content`; for binary
   files, verify `content` is `null` and that text editing is rejected. For ZIP
   uploads, build archives in memory and cover nested folders, binary entries,
   path traversal, invalid archives, conflicts, and permission failures.
8. Exercise delete behavior and confirm descendants or related rows are gone.
9. Run the full suite, not only the new test, because the fixture shares the
   configured database and cleanup behavior.

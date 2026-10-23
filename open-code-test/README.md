# Organizations Full Stack App

A local-development full stack application for managing organizations and their users.

- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, JWT auth
- **Database:** PostgreSQL with pure SQL migrations
- **Frontend:** React, React Router, TypeScript, Vite, Tailwind CSS
- **Orchestration:** Docker Compose

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/routes/       # HTTP endpoints
│   │   ├── migrations/       # Pure SQL migrations + runner
│   │   ├── repositories/     # Database access layer
│   │   ├── schemas/          # Pydantic request/response models
│   │   ├── services/         # Business logic and permissions
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── security.py
│   ├── Dockerfile
│   └── requirements.txt
├── docker/
│   ├── docker-compose.yml
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/
    │   ├── auth/
    │   ├── components/
    │   └── pages/
    ├── Dockerfile
    └── package.json
```

## Quick start

```bash
cd docker
cp .env.example .env   # optional, defaults work without it
docker compose up --build
```

Open:

- Frontend: <http://localhost:5173>
- API docs (Swagger): <http://localhost:8000/docs>
- API health: <http://localhost:8000/api/health>
- PostgreSQL: `localhost:5433` (user/password/database: `app`)

Default root account (created by the seed migration):

```
email:    root@example.com
password: admin123
```

Change it from the UI by editing your own user, or by creating another root user.

Stop the stack with `docker compose down`. Add `-v` to also delete the database volume.

## Configuration

Compose reads optional overrides from `docker/.env` (see `docker/.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` | `app` | Database user |
| `POSTGRES_PASSWORD` | `app` | Database password |
| `POSTGRES_DB` | `app` | Database name |
| `POSTGRES_PORT` | `5433` | Host port for PostgreSQL |
| `BACKEND_PORT` | `8000` | Host port for the API |
| `FRONTEND_PORT` | `5173` | Host port for the frontend |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Access token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

The frontend dev server proxies `/api` to the backend container. The API is also
reachable directly on port `8000`.

## Permissions

| Action | Member | Root |
| --- | --- | --- |
| View own organization | Yes | Yes |
| View any organization | No | Yes |
| Create/rename/delete organizations | No | Yes (except deleting the organization you belong to) |
| List users in own organization | Yes | Yes |
| List users in any organization | No | Yes |
| Create/update/delete members in own organization | Yes | Yes |
| Create/update/delete root users | No | Yes |
| Promote a user to root | No | Yes |
| Impersonate a member | No | Yes |
| Delete own account | No | No |
| Change own role | No | No |
| Create/rename/delete drives and drive items in own organization | Yes | Yes |
| Create/rename/delete drives and drive items in any organization | No | Yes |

Root target users are read-only for members. These guards prevent accidentally
locking yourself out; they are enforced by the backend and reflected in the UI.

## Drives

Each organization can have multiple drives. A drive is a tree of folders and
files; both metadata and file contents (text or binary) are stored in Postgres.
Drive names are unique per organization (case-insensitive), and file/folder
names are unique within their parent. Uploads are limited to 10 MB per file.

The UI at `/organizations/{id}/drives` supports:

- creating, renaming and deleting drives;
- creating folders and text files, editing file text with an explicit Save (Ctrl+S);
- uploading files (including binaries) and downloading any file;
- renaming and deleting items from a right-click menu;
- multiple selection with Ctrl/Cmd+click, plus copy/paste of independent copies;
- moving files and folders by dragging them onto another folder or the drive root.

Text files open in the editor; binary files show a download card instead. Copying
a file copies its bytes, and deleting a folder or drive permanently deletes
everything inside it.

Deleting a folder or drive permanently deletes everything inside it. Copy
recurses through folders and appends ` (copy)` to name clashes.

## API overview

All endpoints except `POST /api/auth/login` and `GET /api/health` require an
`Authorization: Bearer <token>` header.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Log in with email/password, returns a JWT and the user |
| GET | `/api/auth/me` | Current user |
| GET | `/api/organizations` | All organizations for roots, own organization for members |
| POST | `/api/organizations` | Create organization (root) |
| GET | `/api/organizations/{id}` | Get organization |
| PATCH | `/api/organizations/{id}` | Rename organization (root) |
| DELETE | `/api/organizations/{id}` | Delete organization (root) |
| GET | `/api/organizations/{id}/users` | List users in organization |
| POST | `/api/organizations/{id}/users` | Create user |
| GET | `/api/organizations/{id}/users/{userId}` | Get user |
| PATCH | `/api/organizations/{id}/users/{userId}` | Update email/password/role |
| DELETE | `/api/organizations/{id}/users/{userId}` | Delete user |
| POST | `/api/organizations/{id}/users/{userId}/impersonate` | Get a member token (root only) |
| GET | `/api/organizations/{id}/drives` | List drives in an organization |
| POST | `/api/organizations/{id}/drives` | Create a drive |
| GET/PATCH/DELETE | `/api/organizations/{id}/drives/{driveId}` | Read, rename or delete a drive |
| GET | `/api/organizations/{id}/drives/{driveId}/items` | List folder/file metadata |
| POST | `/api/organizations/{id}/drives/{driveId}/folders` | Create a folder |
| POST | `/api/organizations/{id}/drives/{driveId}/files` | Create a text file |
| POST | `/api/organizations/{id}/drives/{driveId}/files/upload` | Upload a file (multipart form field `file`, optional `parent_id`) |
| GET | `/api/organizations/{id}/drives/{driveId}/items/{itemId}` | Get an item (text files include content) |
| GET | `/api/organizations/{id}/drives/{driveId}/items/{itemId}/download` | Download file bytes |
| PATCH | `/api/organizations/{id}/drives/{driveId}/items/{itemId}` | Rename or move an item |
| PUT | `/api/organizations/{id}/drives/{driveId}/items/{itemId}/content` | Save text file content |
| DELETE | `/api/organizations/{id}/drives/{driveId}/items/{itemId}` | Delete an item and its descendants |
| POST | `/api/organizations/{id}/drives/{driveId}/items/copy` | Copy items into a target folder |

Example login:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"root@example.com","password":"admin123"}'
```

## Database migrations

Migrations are plain SQL files in `backend/app/migrations/`, named so they apply
in order (for example `003_add_something.sql`).

On backend startup the migration runner:

1. Takes a PostgreSQL advisory lock to avoid concurrent runners.
2. Creates the `schema_migrations` tracking table if needed.
3. Applies pending `.sql` files in filename order, each inside a transaction.
4. Records each applied version in `schema_migrations`.

To add or change the schema, add a new numbered SQL file and restart the backend
(or let `--reload` restart it). Never edit an already-applied migration.

## Local development without Docker

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://app:app@localhost:5433/app
export JWT_SECRET=dev-secret-change-me
uvicorn app.main:app --reload
```

Frontend (Node 22+):

```bash
cd frontend
npm install
npm run dev
```

Useful checks:

```bash
cd frontend && npm run build        # typecheck + production build
docker compose -f docker/docker-compose.yml logs -f backend
docker compose -f docker/docker-compose.yml exec db psql -U app -d app
```

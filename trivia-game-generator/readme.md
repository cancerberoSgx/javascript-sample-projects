# trivia game generator and playground

## Quick start

```bash
./docker/init-env.sh                                  # once: creates .env with generated secrets and prints the root password
docker compose -f docker/docker-compose.yml up --build
```

Open http://localhost:5173 and log in with `ROOT_EMAIL` / `ROOT_PASSWORD` from `.env`.



## dev env fast notes

make sure db is running - if not invoke above docker compose command and make sure container is running.

cd backend; uv run uvicorn app.main:app --reload       # reads DATABASE_URL from ../.env

cd frontend: npm run dev



# file structure

| Folder | What |
|---|---|
| `frontend/` | React + Vite app: login, Organizations tab, Boards demo (root only). See [frontend/README.md](frontend/README.md) |
| `backend/` | FastAPI + Postgres REST API with plain-SQL repositories and migrations. See [backend/README.md](backend/README.md) |
| `docker/` | `docker-compose.yml` (db + backend + frontend in dev mode), `init-env.sh` |
| `rules.md` | Game rules spec referenced by the engine |
| `.env.example` | All configuration; copy it to `.env` (or run `init-env.sh`) |


## Backing up and sharing decks and boards

Every deck and board has **⬇ Export JSON** (in its editor), and the Decks and Boards lists have **⬆ Import**. A file is the same format as the examples in `frontend/public/` (rules.md §7b), one line per card or space, so it is easy to edit by hand, with a script, or with an LLM, and to keep in git. Importing always creates a new deck or board ("(imported)" is added if the name is taken). Deck categories are matched by name or created. A board file keeps its background *settings* but not the image: keep the image file too, and pick it again after importing into another organization or a fresh database. **Whole organization:** the organization page (Organizations / My organization) has a **Backup** panel. **⬇ Export everything** saves every category, deck (with its cards) and board in one `<org>.organization.json`; **⬆ Import** adds a backup to the selected organization, e.g. a new empty one after a database reset. Decks and boards whose name is already there are skipped, so importing twice is harmless. Games, users and API keys are not in the file. Scripts can use the API directly (`GET /api/decks/{id}/export`, `POST /api/decks/import`, same for boards; see `backend/README.md`).

## Play with friends over the internet (ngrok)

You can host a game from your own machine and let friends join from their phones anywhere. Only the
**frontend port** needs a tunnel: the Vite server already forwards `/api`, the game WebSockets and `/media`
to the backend, so everything goes through one public URL.

1. **Once:** create a free account at https://ngrok.com, install ngrok, and add your token:
   ```bash
   ngrok config add-authtoken <your-token>
   ```
2. **Start the app** as usual (Quick start above, or `npm run dev` + uvicorn). Check that http://localhost:5173 works.
3. **Open the tunnel** to the frontend port (`FRONTEND_HOST_PORT`, 5173 by default):
   ```bash
   ngrok http 5173
   ```
   ngrok prints a `Forwarding https://<something>.ngrok-free.app` URL.
   Tip: your free account includes one fixed domain (ngrok dashboard → Domains). Use it with
   `ngrok http --url=<your-domain>.ngrok-free.app 5173` so the address stays the same between sessions.
4. **Host from the ngrok URL, not from localhost.** Open the `https://….ngrok-free.app` address, log in, create
   or open a game, and copy its join link. The link is built from the address in your browser, so a link copied
   from `localhost` only works on your own computer.
5. **Send the link to your friends.** They open it on their phones, pick a name and join the lobby (no account
   needed). You start the game when everybody is in.

Good to know:
- **ngrok's warning page:** on the free plan, the first visit shows an "You are about to visit…" page. Friends
  tap **Visit Site** once; after that the game works normally (including the live WebSocket updates).
- **Your whole app is public while the tunnel runs**, including the login page and the API docs. Use a strong
  `ROOT_PASSWORD` (`init-env.sh` generates one), and stop ngrok (Ctrl+C) when you're done. Games can only be
  joined with their join code, which is in the link.
- **Many players or a slow connection?** The dev server sends hundreds of small files on the first load. A
  production build is much lighter and faster. With the backend running on port 8000:
  ```bash
  cd frontend
  npm run build
  npx vite preview --port 4173      # same /api and /media forwarding as the dev server
  ngrok http 4173
  ```
  Rebuild after you change frontend code.
- **Other tunnels** (Cloudflare Tunnel, Tailscale Funnel, your own domain): Vite only accepts known hostnames.
  ngrok's are allowed in `frontend/vite.config.ts`. Add yours with `VITE_ALLOWED_HOSTS` (comma-separated, a
  leading `.` allows all subdomains), for example
  `VITE_ALLOWED_HOSTS=.trycloudflare.com npm run dev`. With Docker Compose, put `VITE_ALLOWED_HOSTS=…` in `.env`.
- The tunnel only lasts while your computer, the app and ngrok keep running. For a permanent setup, see the
  hosting notes at the end of this file.




---


# old notes:



gpt idea: trivia generator

ideas / high level first thoughts

 * build a trivia game / framework with nice UI and configurable resources (board img, dices, rules)
 * be able to generate topics (science) with q and answers
    * user can create their own trivia and define the categories: "classical music", "jazz music", "music theory", "musicians biography", etc
 * be able to define difficulty level "Please generate 5 questions and answers make the questions hard to respond"
 * answer checking: if user respond with a synonim then we could ask gpt: 
    working prompt: 
      *** you are assisting generating trivia questions and answers for topic "science". Given following question and correct-answer, and user's answer, can you tell me if their response was aproximately right ? 
      Question: What is the charge of a strange quark in elementary charge units?
      Correct Answer: -1/3
      User's answer: one third
          *** gpt answer: Yes, the user's answer is approximately correct. The correct answer for the charge of a strange quark is "-1/3" elementary charge units. The user's response of "one third" is equivalent to "-1/3," so it can be considered approximately right.

problems examples:
  * how to not repeat ? <- generate a lot of questions together from each topic
prompt: you are assiting generating trivia questions and answers for topic "science". Answers need to be concrete words or numbers. Please generate 5 questions and answers 

UX / 
 * roles: game creator: I create a new trivia by defining: 
 * design: board img, dice design, pieces design, 
 * question/topics : a list of topics with descriptions
 * en / es internationalization - (for q & a)


stack: 
 * mysql + node.js-express 
    can we deploy both with docker compose in a single ec2?
 * react+typescript
 * user registration + login + session



we can also ask gpt to generate topics classification for a certain field, for example a trivia of science: 
 *** you are assisting generating trivia game-like. Could you please define five big topics in science to use them as question categories ? 
 use case: as a user I need assistance defining classification for certain big topic.




iterations (releases / productize)

first iteration: compete against yourself and compare with others

 * be able to generate a simple game :
 * single-user
 * have predefined topics.
 * they can "track" their own scores, question by questions for each topic
 * they see their scores across all other users in a single topic + difficulty
 * the key is topic + difficulty (which is a number from 1 to 10)


second iteration: play a trivia game realtime against other users



idea: dell-e playgrouond

this is html mask generator for dall-e https://medium.com/@david.richards.tech/how-to-create-openai-dall-e-mask-images-ed8feb562eba
productize this, and also add other features: 
 * change image dimensions (like gimp)

make a product to use dalle apis (generate, edit)
 * for edit, render this new img mask editor so I can try using web.
 * save your queries (input imgs, prompt, config)
 * save your results (img local storage?), download zip ? 
 * support n (multiple outputs)





---


# q about hosting

I'm looking for free hosting sites where I can deploy my apps (or very cheap ones). 

in general my apps consists on a server and a database and with intial support for concurrent users. I prefer my servers platform to be python or node.js , the frontend as a single page app in react, and the database relational preferably postgres (sqlite won't do because of concurrent sessions?)

I also want to search docker-compose for my local dev environment

Can you search for free or cheap hosting providers where I can host these kind of apps (with little traffic)


Answer:

Neither platform runs a `docker-compose.yml` directly, but on Render the move is easy. Hatchable doesn't fit your setup well.

## Render: easy, with one change

Render doesn't support Docker Compose. It does build and run Dockerfiles, so your existing **server image works as is**. The change is that the db container gets replaced by a managed Postgres (Render's, or Neon). In practice:

- **Server:** keep your Dockerfile. Render builds it from your Git repo.
- **DB:** don't deploy the Postgres container. On free hosting it would have no persistent disk. Use a managed Postgres and pass its URL as `DATABASE_URL`. Locally, compose keeps running its own postgres container, so nothing changes in your daily work.
- **Frontend:** a static site, built with `npm run build`.

You describe all of this in a `render.yaml` ("Blueprint") at the repo root. It does roughly the job of your compose file:

```yaml
services:
  - type: web
    name: api
    runtime: docker
    dockerfilePath: ./server/Dockerfile
    dockerContext: ./server
    plan: free
    envVars:
      - key: DATABASE_URL
        sync: false          # paste your Neon URL in the dashboard

  - type: web
    name: frontend
    runtime: static
    rootDir: client
    buildCommand: npm ci && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite        # SPA fallback for React Router
        source: /*
        destination: /index.html
```

To keep the code the same in both environments, have the server read only `DATABASE_URL`. Compose sets it to `postgres://...@db:5432/app` and Render sets it to the Neon URL.

## Hatchable: not a good fit

Hatchable is a newer free platform made for apps built by AI coding agents. It gives each project Node.js 20, Postgres, auth and storage. I couldn't find anything showing it runs your own Docker images, and it doesn't appear to support Python. Using it would mean adapting to its platform, so you'd lose your compose workflow.

## If you want to deploy the compose file itself

- **A VPS with Coolify or Dokploy** (e.g. a ~€4–5/mo Hetzner server, or Oracle's free tier): both deploy a `docker-compose.yml` directly, and the db container gets a real persistent volume. Your local setup and production stay nearly identical.
- **Railway** can import a compose file and turn each service into its own service, as far as I know. It isn't free beyond the trial credit, though; expect about $5/mo.

**My suggestion:** use Render + Neon for free demos, since it's only a small translation from compose. For apps you'll keep running, use a cheap VPS with Coolify or Dokploy, where your compose file is the deployment config.

Sources:
- [Render Blueprint YAML Reference](https://render.com/docs/yaml-spec)
- [Render tutorial – Docker and image runtimes](https://render.com/tutorials/advanced-blueprint-patterns/docker-and-image-runtimes)
- [Render community – transforming docker-compose to render.yaml](https://community.render.com/t/how-to-transform-my-docker-compose-to-render-yaml/11067)
- [Render community – docker-compose deploy issue](https://community.render.com/t/deploy-with-docker-compose-issue/7512)
- [Hatchable (Woobox)](https://cdn.woobox.com/hatchable)
- [Hatchable MCP](https://mcp.so/ja/servers/hatchable-mcp)





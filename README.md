# nestjs-rag

NestJS 12 learning sandbox: a permission-aware RAG API with upload, search, streaming chat and agent mode.
Design: `docs/superpowers/specs/2026-10-14-nestjs-rag-design.md`. Running notes: `docs/implementation-notes.md`.

## Run

Prerequisites: Node 26.10.0 (`.nvmrc`; `engines` also accepts 22.22.3+ and 24.15+), Docker Desktop, Ollama.

    docker compose up -d     # Postgres + pgvector on host port 5434
    ollama pull nomic-embed-text
    ollama pull qwen3:8b     # or any chat model; set CHAT_MODEL to match (for example qwen3:4b)
    cp .env.example .env     # set JWT_SECRET (32+ chars); ADMIN_EMAIL / ADMIN_PASSWORD seed the first admin
    npm install
    npm run start:dev

- API docs (Swagger): http://localhost:3001/docs
- Chat test page: http://localhost:3001/ui/chat.html

## Test

    npm test            # unit tests, no Docker needed
    npm run test:e2e    # Testcontainers Postgres, fake embeddings, mock chat model (Docker needed)
    npm run lint && npm run build

## Migrations

Pending migrations run at app start. The CLI works on the compiled output:

    npm run migration:show
    npm run migration:run
    npm run migration:revert

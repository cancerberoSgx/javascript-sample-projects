FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# The virtualenv lives outside /app so bind-mounting source code in dev doesn't hide it
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml uv.lock ./
# Includes dev dependencies so the test suite can run inside the container
RUN uv sync --frozen

COPY app ./app
COPY migrations ./migrations
COPY seeds ./seeds
COPY tests ./tests

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

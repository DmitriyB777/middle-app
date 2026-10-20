# Single-stage uv-based image. Intended to be run with Compose: all environment
# variables (including secrets) are supplied at runtime, never baked into layers.
FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /app

# Install dependencies first so this layer is cached while application code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy the application and finish the environment installation.
COPY . .
RUN uv sync --frozen --no-dev

# Compose runs `flask db upgrade`; point the CLI at main.py explicitly since the
# entry point is not the `app` package auto-discovery target.
ENV PATH="/app/.venv/bin:$PATH" FLASK_APP=main.py

EXPOSE 8000

CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "gthread", "--threads", "4", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-"]

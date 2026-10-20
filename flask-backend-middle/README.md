# 🚀 flask-backend-middle

REST API на Flask для работы с иерархией регионов и городов. Аутентификация — JWT, база данных — PostgreSQL, миграции — Alembic (Flask-Migrate).

Стек: Python 3.14, Flask 3, Flask-SQLAlchemy, Flask-JWT-Extended, PostgreSQL, pytest, ruff.

## 🧰 Требования

- Python 3.14+ и пакетный менеджер [uv](https://docs.astral.sh/uv/).
- Docker с Compose v2 — для базы данных и запуска в контейнерах. В WSL включите интеграцию Docker Desktop (Settings → Resources → WSL Integration).

## 📦 Установка зависимостей

```
    uv sync
```

## 🔐 Переменные окружения

Скопируйте пример и заполните значения:

```
    cp .env.example .env
```

Приложение читает настройки из переменных окружения. `.env` — локальные значения по умолчанию, переменные реального окружения имеют приоритет над файлом.

- `DATABASE_URL` — полная строка подключения PostgreSQL (необязательно; если задана, переменные `DB_*` игнорируются).
- `DB_USER` — пользователь БД (по умолчанию `postgres`).
- `DB_PASSWORD` — пароль пользователя БД (обязателен, если не задан `DATABASE_URL`).
- `DB_HOST` — хост БД (по умолчанию `127.0.0.1`).
- `DB_PORT` — порт БД (по умолчанию `5432`).
- `DB_NAME` — имя БД (по умолчанию `flask-backend-middle-db`).
- `JWT_SECRET_KEY` — секрет для подписи JWT (обязателен).

Сгенерировать секрет:

```
    python -c "import secrets; print(secrets.token_hex(32))"
```

`.env` не коммитится, а `.env.example` содержит только плейсхолдеры. В production переменные передаёт runtime (systemd `EnvironmentFile=`, Docker `-e` и т.п.). Если обязательные переменные не заданы, приложение завершается с `RuntimeError` с указанием на `.env` / `.env.example`. Секрет `JWT_SECRET_KEY` из истории git считайте скомпрометированным и замените в production.

## 🐳 Docker Compose

`compose.yaml` поднимает PostgreSQL и приложение под gunicorn. Значения `DB_PASSWORD` и `JWT_SECRET_KEY` Compose берёт из `.env` (см. раздел выше); без них запуск завершится ошибкой.

```
    docker compose up --build
    docker compose up --build -d
    docker compose logs -f app
    docker compose down
```

⚠️ `docker compose down -v` удаляет volume `postgres_data` вместе с данными БД.

Что запускается:

- `db` — PostgreSQL 17, volume `postgres_data`, порт `127.0.0.1:5432`, healthcheck.
- `app` — образ из `Dockerfile`, gunicorn на порту 8000; перед стартом автоматически выполняется `flask db upgrade`, внутри сети `DB_HOST=db`.

Нужна только БД для локальной разработки — поднимите `db`, а приложение запускайте на хосте: `.env` с `DB_HOST=127.0.0.1` работает, потому что порт опубликован.

```
    docker compose up -d db
```

Применить миграции вручную в запущенном контейнере:

```
    docker compose exec app flask db upgrade
```

Секреты не попадают в образ: `.env` исключён в `.dockerignore`.

## ⚙️ Локальный запуск

Примените миграции:

```
    uv run flask db upgrade
```

Запуск dev-сервера:

```
    uv run flask --app main.py run --debug
```

Без debug:

```
    uv run flask --app main.py run
```

## 🚀 Запуск через gunicorn (production)

```
    uv run gunicorn main:app --bind 0.0.0.0:8000 --workers 4 --worker-class gthread --threads 4 --timeout 60 --access-logfile - --error-logfile -
```

- `--workers` — число воркеров, ориентир `2 * CPU + 1`; каждый воркер — отдельный процесс.
- `--worker-class gthread --threads 4` — многопоточные воркеры для I/O-нагрузки (запросы к PostgreSQL).
- `--timeout` — таймаут воркера в секундах.
- `--access-logfile -` и `--error-logfile -` — логи в stdout/stderr.

Фоновый запуск на сервере:

```
    setsid nohup uv run gunicorn main:app --bind 0.0.0.0:8000 --workers 4 --worker-class gthread --threads 4 --timeout 60 --access-logfile - --error-logfile - --pid /tmp/flask-backend-middle-gunicorn.pid > /tmp/flask-backend-middle-gunicorn.log 2>&1 &
```

Логи, остановка и graceful reload:

```
    tail -f /tmp/flask-backend-middle-gunicorn.log
    kill $(cat /tmp/flask-backend-middle-gunicorn.pid)
    kill -HUP $(cat /tmp/flask-backend-middle-gunicorn.pid)
```

## ✅ Проверка приложения

```
    curl -i http://127.0.0.1:8000/api/regions
```

Эндпоинт защищён JWT, поэтому корректный ответ при запущенном приложении — HTTP 401 с JSON `{"error":"authorization_token",...}`. Это подтверждает, что приложение поднялось. Ответы 500 на эндпоинтах с БД означают, что база недоступна или не применены миграции.

## 🧪 Тесты

```
    uv run pytest
    uv run pytest -m unit
    uv run pytest -m integration
    uv run pytest -m e2e
    uv run pytest --cov=app --cov-report=term-missing
```

## 🧹 Линтер и форматирование (ruff)

```
    uv run ruff check .           # проверить код
    uv run ruff check --fix .     # исправить найденные проблемы
    uv run ruff format .          # отформатировать
    uv run ruff format --check .  # проверить форматирование без изменений
```

## 🩺 Troubleshooting

- `RuntimeError: Missing required configuration` — не создан `.env` или не заполнены `DB_PASSWORD` / `JWT_SECRET_KEY`: `cp .env.example .env` и заполните значения.
- `500` на эндпоинтах с БД, `psycopg2.OperationalError ... Connection refused` — не запущена БД или не применены миграции: `docker compose up -d db`, затем `uv run flask db upgrade`.
- `bind: address already in use` — порт 8000 (или 5432) занят, например локальным gunicorn: остановите процесс или измените `ports` в `compose.yaml`.
- `uv run flask` использует системный Flask вместо venv — выполните `.venv/bin/python -m flask ...` или пересоздайте окружение: `rm -rf .venv && uv sync`.

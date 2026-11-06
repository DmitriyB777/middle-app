# middle-app

Монорепозиторий полностекового приложения: REST API на Flask, SPA на React и
PostgreSQL. Весь стек поднимается одной командой через Docker Compose.

## Состав репозитория

- `flask-backend-middle/` — REST API на Flask, PostgreSQL, JWT, миграции Alembic.
- `react-frontend-middle/` — SPA на React 19 + TypeScript + Vite.
- `compose.yaml` — сервисы `db`, `app`, `frontend` с проектом `middle-app`.
- `.env.example` — шаблон переменных окружения для Compose.

## Быстрый старт

Требования: Docker и Docker Compose v2.

```bash
cp .env.example .env
# заполните DB_PASSWORD и JWT_SECRET_KEY
docker compose up --build
```

Откройте https://localhost и примите предупреждение о самоподписанном
сертификате (один раз для локальной разработки).

## Порты

| Порт | Назначение |
| --- | --- |
| 80 | HTTP, редирект на HTTPS |
| 443 | HTTPS, frontend (nginx) |
| 8000 | backend API (gunicorn, напрямую) |
| 5432 | PostgreSQL (только 127.0.0.1) |

## Сервисы Compose

- `db` — PostgreSQL 17, данные в volume `postgres_data`, опубликован только на `127.0.0.1:5432`.
- `app` — Flask/gunicorn из `./flask-backend-middle`, порт 8000, перед стартом выполняет `flask db upgrade`.
- `frontend` — nginx из `./react-frontend-middle`, стандартные порты 80/443, HTTPS и прокси `/api` на `app:8000`; стартует после healthy `app`.

## Остановка

```bash
docker compose down
```

⚠️ `docker compose down -v` удаляет volume `postgres_data` вместе с данными БД.

## Локальная разработка

Backend (`flask-backend-middle/`):

```bash
uv sync
uv run flask db upgrade
uv run flask --app main.py run --debug --port 8000
```

Frontend (`react-frontend-middle/`):

```bash
npm install
npm run dev
```

Vite поднимает dev-сервер на http://localhost:5173.

## HTTPS

Самоподписанный сертификат для разработки генерируется автоматически при старте
контейнера `frontend` в `/etc/nginx/certs/{fullchain,privkey}.pem`. Для
production смонтируйте настоящие `fullchain.pem` и `privkey.pem` в
`/etc/nginx/certs` — скрипт обнаружит их и пропустит генерацию.

## Документация

- [flask-backend-middle](flask-backend-middle/README.md) — backend, API, миграции, тесты.
- [react-frontend-middle](react-frontend-middle/README.md) — frontend, сборка, Docker.

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

## Production из Docker Hub

`compose.yaml` — это локальная конфигурация сборки: `docker compose up --build`
собирает образы `app` и `frontend` на машине, и они остаются локальными, никуда
не публикуются.

`compose.prod.yaml` — оверлей, который только задаёт `image:` для `app` и
`frontend`. Вместе с базовым `compose.yaml` он позволяет на сервере скачивать
готовые образы из Docker Hub вместо сборки, сохраняя `db`, переменные
окружения, порты, healthcheck и volume из базового файла.

Сборка и публикация образов (из корня репозитория):

```bash
docker login
docker compose build
docker tag middle-app-app dmitriyb777/middle-app-backend:1.0.0
docker tag middle-app-frontend dmitriyb777/middle-app-frontend:1.0.0
docker push dmitriyb777/middle-app-backend:1.0.0
docker push dmitriyb777/middle-app-frontend:1.0.0
```

`middle-app-app` и `middle-app-frontend` — стандартные локальные имена образов
Compose. Если они отличаются, посмотрите актуальные имена в `docker compose images`.

Запуск на сервере (из корня репозитория, где лежит `.env`):

```bash
docker login
docker compose -f compose.yaml -f compose.prod.yaml pull
docker compose -f compose.yaml -f compose.prod.yaml up -d --no-build
```

На сервере должен существовать `.env` с секретами (`DB_PASSWORD`,
`JWT_SECRET_KEY`), как и для локального запуска. `compose.prod.yaml` не влияет
на обычный локальный `docker compose up --build`.

Для каждого релиза поднимайте тег (например, `1.0.1`) и обновляйте его в
`compose.prod.yaml`, затем повторяйте `pull` и `up -d --no-build` на сервере.

## HTTPS

Самоподписанный сертификат для разработки генерируется автоматически при старте
контейнера `frontend` в `/etc/nginx/certs/{fullchain,privkey}.pem`. Для
production смонтируйте настоящие `fullchain.pem` и `privkey.pem` в
`/etc/nginx/certs` — скрипт обнаружит их и пропустит генерацию.

## Документация

- [flask-backend-middle](flask-backend-middle/README.md) — backend, API, миграции, тесты.
- [react-frontend-middle](react-frontend-middle/README.md) — frontend, сборка, Docker.

# 🚀 flask-backend-middle

Инструкция по развертыванию и запуску проекта

### 📦 Установка зависимостей

Проект использует пакетный менеджер uv. Виртуальное окружение и зависимости устанавливаются одной командой:

```
    uv sync
```

### 🐘 Настройка базы данных PostgreSQL

Создайте пользовательскую сеть Docker с подсетью (достаточно выполнить один раз):

```
    docker network create --subnet=172.18.0.0/16 flask-backend-middle-net
```

Запустите контейнер PostgreSQL с постоянным IP-адресом:

```
    docker run --name flask-backend-middle --network flask-backend-middle-net --ip 172.18.0.10 -p 5432:5432 -e POSTGRES_PASSWORD=root -e POSTGRES_DB="flask-backend-middle-db" -d postgres
```

База данных flask-backend-middle-db создается автоматически при первом запуске контейнера благодаря переменной POSTGRES_DB, поэтому создавать базу данных вручную не нужно.

Контейнер всегда получает один и тот же адрес 172.18.0.10 в сети flask-backend-middle-net. Статический IP работает только в пользовательской сети — во встроенной сети bridge ключ --ip не поддерживается. Для подключения с хоста по-прежнему используется 127.0.0.1:5432 (проброс порта -p), так как на Windows и macOS контейнерный IP не маршрутизируется напрямую.

### 🔐 Переменные окружения

Скопируйте пример конфигурации и заполните значения:

```
    cp .env.example .env
```

Приложение читает настройки из переменных окружения; `.env` — локальные значения по умолчанию, а переменные реального окружения имеют приоритет над `.env`.

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

`.env` не коммитится в репозиторий, а `.env.example` содержит только плейсхолдеры. В production переменные должен передавать runtime (systemd `EnvironmentFile=`, Docker `-e` и т.п.). Если обязательные переменные не заданы, приложение завершается с понятной `RuntimeError`, указывающей на `.env` / `.env.example`. Секрет `JWT_SECRET_KEY` из истории git следует считать скомпрометированным и заменить в production.

### 🐳 Docker Compose

Для запуска нужны Docker Engine/Desktop с Compose v2; в WSL включите интеграцию Docker Desktop (Settings → Resources → WSL integration).

Compose подставляет значения из `.env`. Если файла нет, создайте его из примера:

```
    cp .env.example .env
```

`DB_PASSWORD` и `JWT_SECRET_KEY` обязательны: без них Compose завершится с ошибкой `Set DB_PASSWORD in .env` / `Set JWT_SECRET_KEY in .env`.

**Запуск** (foreground и в фоне), **логи**, **остановка**:

```
    docker compose up --build
    docker compose up --build -d
    docker compose logs -f app
    docker compose down
```

⚠️ `docker compose down -v` удаляет volume `postgres_data` вместе с данными БД.

**Что запускается:**

- `db` — PostgreSQL 17 (`postgres:17-alpine`), volume `postgres_data`, порт `127.0.0.1:5432`, healthcheck.
- `app` — образ из `Dockerfile`, gunicorn 4 gthread-воркера на порту 8000; перед стартом выполняется `flask db upgrade`, `DB_HOST` принудительно равен `db`.

**Режим только БД:** поднимите `db`, а gunicorn запускайте на хосте — `.env` с `DB_HOST=127.0.0.1` работает, так как порт опубликован:

```
    docker compose up -d db
```

**Миграции вручную** внутри контейнера:

```
    docker compose exec app flask db upgrade
```

**Проверка, что приложение поднялось:**

```
    curl -i http://127.0.0.1:8000/api/regions
```

Ожидаемый ответ — HTTP 401 с `authorization_token`. Секреты не попадают в образ (`.env` исключён в `.dockerignore`); если порты 8000/5432 заняты, измените `ports` в `compose.yaml`.

### ⚙️ Миграции и запуск

Примените последние миграции базы данных:

```
    uv run flask db upgrade
```

**Обычный запуск**

```
    uv run flask --app main.py run
```

**Запуск в режиме отладки (Debug mode)**

```
    uv run flask --app main.py run --debug
```

### 🚀 Запуск через gunicorn (production)

gunicorn — production WSGI-сервер; зависимость уже добавлена в проект (`uv add gunicorn`), при установке с нуля выполните эту команду.

**Основной запуск**

```
    uv run gunicorn main:app --bind 0.0.0.0:8000 --workers 4 --worker-class gthread --threads 4 --timeout 60 --access-logfile - --error-logfile -
```

Флаги:

- `--workers` — число воркеров, ориентир 2 * CPU + 1 (каждый воркер — отдельный процесс).
- `--worker-class gthread --threads 4` — многопоточные воркеры для I/O-нагрузки (запросы к PostgreSQL).
- `--timeout` — таймаут воркера в секундах (60).
- `--access-logfile -` и `--error-logfile -` — логи в stdout/stderr.
- `--preload` не использовать: пул соединений SQLAlchemy/psycopg2 создается до форка и ломается в дочерних процессах.

**Проверка, что приложение поднялось**

```
    curl -i http://127.0.0.1:8000/api/regions
```

Ожидаемый ответ — HTTP 401 с JSON `{"error":"authorization_token",...}`: эндпоинт защищён JWT, поэтому 401 подтверждает успешный старт.

**Запуск в фоне (для сервера)**

```
    setsid nohup uv run gunicorn main:app --bind 0.0.0.0:8000 --workers 4 --worker-class gthread --threads 4 --timeout 60 --access-logfile - --error-logfile - --pid /tmp/flask-backend-middle-gunicorn.pid > /tmp/flask-backend-middle-gunicorn.log 2>&1 &
```

Просмотр лога, остановка и graceful reload:

```
    tail -f /tmp/flask-backend-middle-gunicorn.log
    kill $(cat /tmp/flask-backend-middle-gunicorn.pid)
    kill -HUP $(cat /tmp/flask-backend-middle-gunicorn.pid)
```

⚠️ gunicorn не поддерживается на Windows: в PowerShell используйте waitress (`uv add waitress`, затем `uv run waitress-serve --listen=0.0.0.0:8000 main:app`), а в WSL/Linux — gunicorn.

⚠️ Перед запуском БД должна быть доступна и миграции применены (`uv run flask db upgrade`), иначе эндпоинты с БД вернут 500.

### 🧪 Тесты

Запустите весь набор тестов:

```
    uv run pytest
```

Отдельные уровни тестов (по маркерам):

```
    uv run pytest -m unit
    uv run pytest -m integration
    uv run pytest -m e2e
```

Проверка покрытия кода:

```
    uv run pytest --cov=app --cov-report=term-missing
```

### 🧹 Линтер и форматирование (ruff)

Проверить код линтером:

```
    uv run ruff check .
```

Автоматически исправить найденные проблемы:

```
    uv run ruff check --fix .
```

Отформатировать код:

```
    uv run ruff format .
```

Проверить форматирование без изменений:

```
    uv run ruff format --check .
```

---

⚠️ _Убедитесь, что Docker запущен перед выполнением команд по настройке базы данных._

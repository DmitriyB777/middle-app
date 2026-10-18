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

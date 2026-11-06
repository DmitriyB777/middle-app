# Регионы и города — React frontend

SPA-клиент для Flask REST API из `../flask-backend-middle`. Приложение позволяет
регистрироваться, входить по JWT, управлять иерархией регионов и привязанными к
ним городами.

## Стек

- React 19 + TypeScript (strict)
- Vite 8
- Redux Toolkit (`createSlice`, `createAsyncThunk`, `configureStore`)
- react-redux (типизированные `useAppDispatch` / `useAppSelector`)
- Без UI-библиотек, React Router и axios: переключение экранов и вкладок
  реализовано условным рендерингом.
- Стили — один самодостаточный `src/index.css` с CSS-переменными, светлой и
  тёмной темами (по `prefers-color-scheme`), адаптивной вёрсткой и
  `:focus-visible`.

## Возможности

- Вход и регистрация в одном экране (табы), проверка обязательных полей и
  совпадения паролей. После регистрации выполняется автоматический вход.
- Хранение access/refresh-токенов и имени пользователя в `localStorage`.
- Автоматическое обновление access-токена при `401` и повтор исходного запроса
  (refresh-and-retry). При неудачном refresh сессия очищается, пользователь
  возвращается на экран входа.
- Вкладка «Регионы»:
  - создание региона с выбором родителя (или «Без родителя»);
  - дерево регионов с раскрытием/сворачиванием веток и счётчиками;
  - inline-редактирование названия и родителя с исключением самого региона и
    его потомков из списка вариантов;
  - удаление с подтверждением и предупреждением об удалении потомков и городов.
- Вкладка «Города»:
  - создание города с обязательным выбором региона;
  - фильтр по региону, детали выбранного региона (прямые города и подрегионы);
  - таблица городов с названием региона, inline-редактированием и удалением с
    подтверждением;
  - клиентская фильтрация списка при выбранном регионе.
- Состояния загрузки, ошибок и пустых списков, кнопки повторной загрузки.
- Ошибки backend переводятся в понятные сообщения на русском; сетевые ошибки
  показываются отдельным текстом.

## Запуск backend

Backend живёт в `../flask-backend-middle` и по умолчанию требует PostgreSQL,
`.env` с `DB_PASSWORD`/`JWT_SECRET_KEY` и применённые миграции.

```bash
cd ../flask-backend-middle
cp .env.example .env          # заполните DB_PASSWORD и JWT_SECRET_KEY
uv sync
uv run flask db upgrade
uv run flask --app main.py run --debug --port 8000
```

Важно: dev-сервер Flask по умолчанию слушает порт **5000**, а Vite-прокси в этом
проекте настроен на **`http://127.0.0.1:8000`**. Поэтому либо запускайте Flask с
`--port 8000` (как выше), либо задайте другой адрес через
`VITE_API_PROXY_TARGET` (см. ниже).

Альтернатива — весь стек в Docker Compose из корня репозитория (`..`):
поднимаются PostgreSQL, backend и frontend.

```bash
cd ..
docker compose up --build
```

## Запуск frontend

```bash
cd react-frontend-middle
npm install
npm run dev
```

Vite выведет локальный адрес (обычно `http://localhost:5173`). Откройте его в
браузере.

Другие команды:

```bash
npm run build    # tsc -b + vite build, результат в dist/
npm run preview  # локальный просмотр production-сборки
npm run lint     # oxlint
```

## Запуск в Docker

Многостадийный `Dockerfile` собирает приложение на `node:24-alpine` и раздаёт
готовые файлы из `dist/` через `nginx:1.29-alpine`. В Compose сервис `frontend` публикуется
на http://localhost:5173 и проксирует `/api` на `app:8000` (см. `nginx.conf`).

Запуск из корня репозитория:

```bash
docker compose up --build
```

Перед запуском скопируйте `.env.example` в `.env` в корне репозитория и задайте
`DB_PASSWORD` и `JWT_SECRET_KEY`.

## Прокси и `VITE_API_PROXY_TARGET`

Все запросы идут на относительный путь `/api`, а Vite проксирует их на backend.
Прокси настроен и для dev-сервера, и для `vite preview` в `vite.config.ts`:

```ts
const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'
```

Переопределить адрес можно переменной окружения:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:5000 npm run dev
```

или создав `.env.local` в `react-frontend-middle`:

```dotenv
VITE_API_PROXY_TARGET=http://127.0.0.1:5000
```

CORS в backend не настраивается и не требуется: браузер обращается к тому же
origin Vite, а прокси пересылает запрос на Flask.

## Структура проекта

```text
src/
  app/
    store.ts                 # configureStore, RootState, AppDispatch, unauthorized handler
    hooks.ts                 # типизированные useAppDispatch / useAppSelector
  api/
    client.ts                # fetch-обёртка, ApiError, Bearer, refresh-and-retry
    tokenStorage.ts          # безопасная работа с localStorage
  types/
    api.ts                   # общие типы API
  features/
    auth/authSlice.ts        # login, register, logout, sessionExpired
    regions/
      regionsSlice.ts        # fetch/create/update/delete регионов
      regionTree.ts          # построение дерева, плоские опции, потомки
    cities/citiesSlice.ts    # города и детали региона
  components/
    AuthPage.tsx
    AppShell.tsx
    RegionsPage.tsx
    RegionTree.tsx
    CitiesPage.tsx
    StatusMessage.tsx        # загрузка / ошибка / пустое состояние
  App.tsx
  main.tsx
  index.css
```

Сборка и запуск в контейнере: `Dockerfile` (multi-stage: node build + nginx
runtime), `nginx.conf` (раздача `dist/` и прокси `/api`), `.dockerignore`.

Поток данных: компонент → `dispatch(thunk)` → `apiRequest()` → Redux slice →
типизированный селектор → UI. API-клиент не импортирует store, чтобы не было
циклических зависимостей: store после создания регистрирует обработчик через
`setUnauthorizedHandler(() => store.dispatch(sessionExpired()))`.

## Соответствие API

Базовый путь: `/api`.

| Действие | Метод и путь | Примечание |
| --- | --- | --- |
| Регистрация | `POST /register` | при успехе автоматически выполняется `POST /login` |
| Вход | `POST /login` | сохраняются `tokens.access`, `tokens.refresh`, `username` |
| Обновление access | `GET /refresh` | заголовок `Authorization: Bearer <refresh>` |
| Выход | `GET /logout` | best-effort; локальная сессия очищается всегда |
| Список регионов | `GET /regions` | JWT access |
| Создание региона | `POST /region` | тело `{ name, parent_id }`, `parent_id` может быть `null` |
| Изменение региона | `PUT /region/:id` | всегда отправляются `name` и `parent_id` |
| Удаление региона | `DELETE /region/:id` | каскадно удаляет потомков и их города |
| Список городов | `GET /cities` | JWT access |
| Детали региона | `GET /cities/:regionId` | `404` с `message: "No cities or sub-regions..."` трактуется как пустой результат |
| Создание города | `POST /city` | тело `{ name, region_id }` |
| Изменение города | `PUT /city/:id` | тело `{ name, region_id }` |
| Удаление города | `DELETE /city/:id` | |

После успешных мутаций фронтенд перезапрашивает актуальные списки. После
удаления региона дополнительно обновляется список городов, а после мутаций
городов — текущие детали выбранного региона.

## JWT и refresh

1. Access-токен прикладывается к защищённым запросам как
   `Authorization: Bearer <access>`.
2. При ответе `401` для защищённого запроса клиент один раз вызывает
   `GET /api/refresh` с refresh-токеном, сохраняет новый access-токен и
   повторяет исходный запрос.
3. Параллельные `401` используют один общий refresh-запрос (single-flight).
4. Refresh не выполняется для `/login`, `/register`, `/refresh` и `/logout`.
5. Если refresh не удался, токены очищаются, store получает `sessionExpired()`,
   пользователь возвращается на экран входа с сообщением об истёкшей сессии.
6. Выход всегда очищает локальную сессию, даже если backend недоступен.

## Production

`npm run build` создаёт статические файлы в `dist/`. В репозитории есть
`Dockerfile` с многостадийной сборкой (`node:24-alpine` собирает приложение,
`nginx:1.29-alpine` раздаёт статику) и `nginx.conf`: файлы из `dist/` попадают в
`/usr/share/nginx/html`, а `/api` проксируется на backend (`http://app:8000`
в сети Compose).

Контейнеризованный запуск из корня репозитория — только фронтенд:

```bash
docker compose up --build frontend
```

или весь стек:

```bash
docker compose up --build
```

Без Docker для production отдавайте `dist/` через reverse proxy (nginx, Caddy,
Traefik и т.п.) и проксируйте `/api` на Flask-приложение. В этом случае фронтенд
и API находятся на одном origin, и CORS не нужен.

Если статику и API разносить на разные origin, потребуется включить и настроить
CORS на стороне Flask, а базовый путь API в клиенте (`src/api/client.ts`) нужно
будет заменить с относительного `/api` на абсолютный URL backend.

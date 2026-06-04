# Theos · Панель управления

Веб-панель для управления AI-инфраструктурой игры **Theos** (RPG-планер):
промпты Теоса, история мира, логи изменений и version-gate. Бэкенд — тот же
Supabase-проект, что и у игры (`APP_SERWER` / `pizesoiespyepoftrrop`).

## Стек
- React 18 + Vite + Tailwind (HashRouter, `base: './'`)
- Supabase (auth email/пароль, RLS, Edge Functions `panel-user` + `ai-proxy`)
- Деплой — GitHub Actions → GitHub Pages

## Возможности
- **Логин** без ролей: кто залогинен — может всё, включая создание новых юзеров
  (через кнопку «Юзеры»).
- **Логи** — лента всех изменений на панели.
- **Промт-мастер**:
  - вкладки по каждому промпту игры (персона Теоса, советник, парсинг задач,
    дейлики, челлендж) — редактирование текста, температуры, вкл/выкл;
  - **История мира** — записи лора, которые подмешиваются в контекст Теоса;
  - **Чат** — живой тест стиля общения через `ai-proxy` (ключ gateway не в браузере).
- **Версия** — version-gate: игроки со старым билдом видят экран «обновитесь».

Промпты модульные: добавил строку в `ai_prompts` — появилась новая вкладка;
приложение тянет промпты/лор/конфиг из БД (с зашитым fallback).

## Разработка
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## Деплой (GitHub Pages)
1. Push в `main` → workflow `.github/workflows/deploy.yml` собирает и публикует.
2. Один раз: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. URL: `https://damian-barabash.github.io/panel-theos/`.

## Первый вход
`dmytrii@theos-rpg.app` / `Qazxplmn_12` (засеян в `auth.users` + `panel_admins`).

## Бэкенд (Supabase)
- Таблицы: `panel_admins`, `ai_prompts`, `world_lore`, `app_config`,
  `panel_logs`, `panel_secrets` (gateway-ключ, только service_role).
- Edge Functions: `panel-user` (CRUD юзеров, service_role),
  `ai-proxy` (прокси к Barabash AI gateway, `think:false`).
- Игра читает `ai_prompts` / `world_lore` / `app_config` под anon-ключом (RLS read-only).

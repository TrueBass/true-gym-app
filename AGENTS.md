# True Gym

Monorepo with two projects. Work inside the relevant folder — commands run from
the repo root will not find the right config.

```
backend/   FastAPI + Postgres API
mobile/    Expo / React Native app
```

The two are not wired together yet: the app still keeps everything on the
device in `mobile/src/storage.js`, and the API mirrors what that file does.
Treat `storage.js` as the contract until the app is moved onto HTTP.

## mobile/

Read `mobile/AGENTS.md` before touching it — the Expo SDK is pinned and that
file explains why. All npm and expo commands run from `mobile/`:

```
cd mobile && npx expo start
```

## backend/

Read `backend/README.md` first — it covers the layout, the endpoints and the
session model. Everything runs from `backend/`:

```
cd backend && docker compose up --build
```

That brings up Postgres and the API together on port 8000. The API reaches the
database over compose's network, so nothing here competes for the host's 5432
and a Postgres installed on the machine can keep running. The database is
published on `127.0.0.1:5433` for psql and for the venv run described in the
README — mind which of the two you are connected to.

`backend/.env.example` documents every variable and `backend/.env` is
gitignored. Two rules about its values: nothing may be prefixed
`EXPO_PUBLIC_` (Expo would inline it into the mobile bundle in cleartext), and
nothing may contain `$` (compose reads the file for interpolation and would
substitute it away).
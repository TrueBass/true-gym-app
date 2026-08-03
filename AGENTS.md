# True Gym

Monorepo with two projects. Work inside the relevant folder — commands run from
the repo root will not find the right config.

```
backend/   Python API (not built yet)
mobile/    Expo / React Native app
```

## mobile/

Read `mobile/AGENTS.md` before touching it — the Expo SDK is pinned and that
file explains why. All npm and expo commands run from `mobile/`:

```
cd mobile && npx expo start
```

## backend/

Empty apart from environment config. `backend/.env.example` documents the
variables the API will need; `backend/.env` is gitignored.
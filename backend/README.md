# backend

Python API for True Gym. Not built yet.

`.env.example` lists the variables it will need — Postgres connection details
and a JWT signing secret. Copy it to `.env` and fill in real values:

```
cp .env.example .env
```

Nothing here may be prefixed `EXPO_PUBLIC_`. Expo inlines any variable with that
prefix into the mobile JS bundle in cleartext, so these values are for the
server only.

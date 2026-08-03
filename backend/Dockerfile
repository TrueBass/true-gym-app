FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# Dependencies before the source, so editing a route doesn't reinstall asyncpg.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Nothing here writes to disk, so the process has no reason to own its own code.
RUN useradd --create-home --uid 1000 api && chown -R api:api /app
USER api

EXPOSE 8000

# Migrations first: the image and the schema it expects ship together, so a
# container that starts is a container whose database matches it.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

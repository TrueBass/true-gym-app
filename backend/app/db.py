import ssl
from collections.abc import AsyncIterator

from sqlalchemy import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Managed Postgres (Neon, Supabase, ...) requires SSL and hands you a URL with
# ?sslmode=require. asyncpg doesn't understand that libpq-style param, so we
# detect it, enable a real SSL context, and strip the query before connecting.
# Local / Docker URLs have no such param and stay plaintext.
url = make_url(settings.database_url)
query = {k.lower(): str(v) for k, v in url.query.items()}
needs_ssl = query.get("sslmode") in {"require", "verify-ca", "verify-full"} or query.get(
    "ssl"
) in {"true", "require"}

connect_args = {"ssl": ssl.create_default_context()} if needs_ssl else {}
# The driver is a deployment detail, not something every .env has to spell out:
# a plain postgresql:// URL is upgraded to the async driver we actually use.
url = url.set(query={}, drivername="postgresql+asyncpg")

engine = create_async_engine(url, pool_pre_ping=True, connect_args=connect_args)

# expire_on_commit=False lets us read attributes after commit without a refresh.
session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Request-scoped session. Rolls back if the handler raised, so a failed
    request can never leave half its writes behind."""
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

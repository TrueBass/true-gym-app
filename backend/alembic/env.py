import asyncio
from logging.config import fileConfig

from alembic import context

from app.db import engine, url
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    # The URL is handed to Alembic directly rather than through
    # config.set_main_option: values set there are read back by configparser,
    # which treats % as interpolation syntax and chokes on a password with any
    # percent-escape in it. It is the URL db.py already normalised, so offline
    # SQL is generated against the same dialect the API connects with.
    context.configure(
        url=url.render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    # Reuse the app engine so migrations get the same SSL/connection handling.
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.errors import DomainError
from app.routers import auth

app = FastAPI(title="True Gym API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    """Flattens FastAPI's list-of-errors into the same {"detail": "..."} shape
    everything else returns.

    The app renders `detail` straight into the form's error line, so one string
    is all it can use — and the field validators already phrase their messages
    for that line ("Password must be at least 6 characters."), which the default
    envelope would bury.
    """
    first = exc.errors()[0]
    message = first.get("msg", "That request wasn't valid.")
    # Pydantic prefixes anything raised as a ValueError; the rest is our copy.
    message = message.removeprefix("Value error, ")
    if first.get("type") == "missing":
        field = first["loc"][-1] if first.get("loc") else "field"
        message = f"Missing required field: {field}."
    return JSONResponse(status_code=422, content={"detail": message})


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)

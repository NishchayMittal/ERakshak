from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.connectors.base import registry
from app.connectors.crtsh import CrtShConnector
from app.connectors.whois import WhoisConnector
from app.connectors.wayback import WaybackConnector
from app.connectors.username_enum import UsernameEnumConnector
from app.connectors.breach_demo import BreachDemoConnector
from app.connectors.face_matcher import FaceMatcherConnector
from app.database import Base, engine
from app.routers import auth as auth_router
from app.routers import cases as cases_router
from app.routers import identifiers as identifiers_router


app = FastAPI(title="e-Rakshak API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(cases_router.router)
app.include_router(identifiers_router.router)

registry.register(CrtShConnector())
registry.register(WhoisConnector())
registry.register(WaybackConnector())
registry.register(UsernameEnumConnector())
registry.register(BreachDemoConnector())
registry.register(FaceMatcherConnector())


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/connectors")
async def health_connectors() -> dict[str, dict]:
    import asyncio
    connectors = registry.all()

    async def check(conn):
        try:
            is_healthy = await conn.check_health()
        except Exception:
            is_healthy = False
        return conn.name, {"status": "healthy" if is_healthy else "unhealthy"}

    results = await asyncio.gather(*(check(c) for c in connectors))
    return dict(results)
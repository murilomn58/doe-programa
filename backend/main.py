"""FastAPI entrypoint: mounts routers, configures dev CORS for the frontend."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import designs, experiments

app = FastAPI(title="DoE Programa API", version="0.1.0")

# Dev CORS: frontend runs on localhost:3000 by default. Overridable (comma
# separated) via CORS_ORIGINS for setups where the port differs.
cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(experiments.router)
app.include_router(designs.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}

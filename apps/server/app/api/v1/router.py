"""API v1 main router."""

from fastapi import APIRouter

from app.api.v1 import analytics, logs, prompts, scenarios, variables

router = APIRouter()

# Include sub-routers
router.include_router(variables.router)
router.include_router(prompts.router)
router.include_router(scenarios.router)
router.include_router(logs.router)
router.include_router(analytics.router)

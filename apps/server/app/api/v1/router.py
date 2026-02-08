"""API v1 main router."""

from fastapi import APIRouter

from app.api.v1 import ai_lab, analytics, conversations, logs, prompts, scenarios, themes, variables

router = APIRouter()

# Include sub-routers
router.include_router(variables.router)
router.include_router(prompts.router)
router.include_router(scenarios.router)
router.include_router(logs.router)
router.include_router(analytics.router)
router.include_router(themes.router)
router.include_router(ai_lab.router)
router.include_router(conversations.router)



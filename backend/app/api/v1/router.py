from fastapi import APIRouter

from app.api.v1 import auth, tasks

api_router = APIRouter()

# Agrega todos os sub-routers
api_router.include_router(auth.router)
api_router.include_router(tasks.router)

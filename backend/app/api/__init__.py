from fastapi import APIRouter

from app.api import assets, auth, bulk, map, network, substations, users

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(map.router)
api_router.include_router(substations.router)
api_router.include_router(network.lines_router)
api_router.include_router(network.towers_router)
api_router.include_router(assets.solar_router)
api_router.include_router(assets.ehv_router)
api_router.include_router(bulk.router)

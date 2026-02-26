import uvicorn
from fastapi import FastAPI
from app.core.database import init_db , close_db
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.api.middleware.auth import NextAuthJWTMiddleware
from app.api.routes.v1.user_routes import router as user_router
from app.api.routes.v1.project_routes import router as project_router
from app.api.routes.v1.message_routes import router as message_router
from app.api.routes.v1.build_routes import router as build_router
from app.api.routes.v1.artifact_routes import router as artifact_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Next.js development server
        "http://127.0.0.1:3000",     # Alternative localhost format
        "http://localhost:8000",      # FastAPI server (for SSE)
        "http://127.0.0.1:8000",     # Alternative FastAPI format
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

"""
Middleware for NextAuth.js JWT authentication
"""
app.add_middleware(NextAuthJWTMiddleware)


# ROUTES
app.include_router(user_router, prefix="/api/v1")
app.include_router(project_router, prefix="/api/v1")
app.include_router(message_router, prefix="/api/v1")
app.include_router(build_router, prefix="/api/v1")
app.include_router(artifact_router, prefix="/api/v1")



@app.get("/")
async def root():
    return {
        "message": "Welcome to the NexusAI API",
        "version": "1.0.0",
        "status": "success"
    }

@app.get("/health")
async def health_check():
    return {
        "message": "Health check successful",
        "status": "success"
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", reload=True)
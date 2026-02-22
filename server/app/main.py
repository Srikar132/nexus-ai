import uvicorn
from fastapi import FastAPI
from app.core.database import init_db
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.api.middleware.auth import NextAuthJWTMiddleware
from app.api.routes.v1.user_routes import router as user_router
from app.api.routes.v1.project_routes import router as project_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use NextAuth JWT middleware instead of GitHub token middleware
app.add_middleware(NextAuthJWTMiddleware)

# Import and register routes
app.include_router(user_router, prefix="/api/v1")
app.include_router(project_router, prefix="/api/v1")



@app.get("/")
async def read_root():
    return {"Hello": "World"}



if __name__ == "__main__":
    uvicorn.run("app.main:app", reload=True)
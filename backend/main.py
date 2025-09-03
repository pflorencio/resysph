from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.routes import router as api_router
from db import connect, disconnect, prisma

app = FastAPI(title="ResysPH API")

# CORS (open for dev; tighten in prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify allowed origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup() -> None:
    await connect()
    # Expose Prisma client globally if you want to access it from request.app.state
    app.state.prisma = prisma

@app.on_event("shutdown")
async def shutdown() -> None:
    await disconnect()

# Health check endpoint
@app.get("/health")
async def health():
    return {"status": "ok"}

# Mount your API under /api
app.include_router(api_router, prefix="/api")

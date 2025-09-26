from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.routes import router as api_router
from db import connect, disconnect, prisma

app = FastAPI(title="ResysPH API")

# CORS — restrict to your frontend in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup() -> None:
    await connect()
    app.state.prisma = prisma  # optional: access via request.app.state.prisma

@app.on_event("shutdown")
async def shutdown() -> None:
    await disconnect()

# Health check
@app.get("/health")
async def health():
    return {"status": "ok"}

# Mount API under /api
app.include_router(api_router, prefix="/api")

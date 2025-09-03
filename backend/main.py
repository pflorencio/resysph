from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.routes import router as api_router  # ✅ explicit import from routes/routes.py
from prisma_client import Prisma

app = FastAPI()

# CORS middleware (optional, but useful during dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prisma client init (not used directly in main.py, but initialized here)
prisma = Prisma()

@app.on_event("startup")
async def startup():
    await prisma.connect()

@app.on_event("shutdown")
async def shutdown():
    await prisma.disconnect()

# Include all routes from routes.py
app.include_router(api_router)

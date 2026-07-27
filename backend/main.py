from fastapi import FastAPI
from db.supabase import supabase  # this imports our client
import sys
from fastapi.middleware.cors import CORSMiddleware
from api.routers import upload 
from api.routers import jobs  

app = FastAPI(title="Manhwa Video Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(upload.router)
app.include_router(jobs.router)


@app.get("/")
async def root():
    return {"message": "Backend is running!"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/db-test")
async def db_test():
    # Try a simple query to see if Supabase works
    try:
        # Fetch one row from processing_jobs (might be empty)
        data = supabase.table("processing_jobs").select("*").limit(1).execute()
        return {"db_connected": True, "rows": len(data.data)}
    except Exception as e:
        return {"db_connected": False, "error": str(e)}
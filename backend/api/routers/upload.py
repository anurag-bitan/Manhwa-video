import logging
from pathlib import Path
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from core.auth import AuthenticatedUser, get_current_user
from db.supabase_admin import supabase_admin
from core.langgraph_app import run_pipeline, PipelineState

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 50 * 1024 * 1024

def process_pipeline_background(job_id: str, pdf_storage_path: str,
                                manhwa_name: str = "", genre: str = "", chapter_number: str = ""):
    state: PipelineState = {
        "job_id": job_id,
        "pdf_storage_path": pdf_storage_path,
        "page_urls": [],
        "panels": [],
        "ocr_results": [],
        "status": "UPLOADED",
        "series_context": "",
        "chapter_info": {},
        "story_summary": "",
        "scenes": [],
        "panel_descriptions": [],
        "rolling_summary": "",
        "narration": [],
        "audio_urls": [],
        "error": None,
        "manhwa_name": manhwa_name,
        "genre": genre,
        "chapter_number": chapter_number,
        "timings": [],
        "combined_audio_url": "",
        "combined_audio_path": "",
    }
    print(f"🚀 Starting pipeline for job {job_id}")
    try:
        final_state = run_pipeline(state)
        supabase_admin.table("processing_jobs").update({
            "status": final_state["status"],
            "state_json": final_state
        }).eq("id", job_id).execute()
    except Exception as e:
        supabase_admin.table("processing_jobs").update({
            "status": "FAILED",
            "state_json": {"error": str(e)}
        }).eq("id", job_id).execute()

@router.post("/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(get_current_user),
    # Accept both 'file' and 'manga_pdf' for the PDF
    file: UploadFile = File(None),
    manga_pdf: UploadFile = File(None),
    manga_name: str = Form(""),
    manga_genre: str = Form(""),
    chapter_number: str = Form(""),
    manhwa_name: str = Form(""),   # alternative field names
    genre: str = Form(""),
):
    # Determine which file was sent
    pdf_file = file or manga_pdf
    if not pdf_file:
        raise HTTPException(status_code=400, detail="No PDF file provided")

    filename = Path(pdf_file.filename or "upload.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    pdf_bytes = await pdf_file.read(MAX_PDF_BYTES + 1)
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF must be 50 MB or smaller")
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF")

    file_path = f"{uuid.uuid4()}/source.pdf"

    # Upload to Supabase
    try:
        supabase_admin.storage.from_("pdfs").upload(
            path=file_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf"}
        )
    except Exception:
        logger.exception("Supabase PDF upload failed")
        raise HTTPException(status_code=500, detail="PDF upload failed")

    pdf_url_response = supabase_admin.storage.from_("pdfs").create_signed_url(
        file_path, 600
    )
    if isinstance(pdf_url_response, str):
        pdf_url = pdf_url_response
    else:
        pdf_url = (
            pdf_url_response.get("signedURL")
            or pdf_url_response.get("signedUrl")
            or pdf_url_response.get("signed_url")
        )

    job = supabase_admin.table("processing_jobs").insert({
        "status": "UPLOADED",
        "pdf_storage_path": file_path,
        "cognito_sub": current_user.sub,
    }).execute()
    job_id = job.data[0]["id"]

    # Use the most specific names provided
    final_manhwa_name = manhwa_name or manga_name
    final_genre = genre or manga_genre

    background_tasks.add_task(
        process_pipeline_background,
        job_id, file_path,
        final_manhwa_name, final_genre, chapter_number
    )

    return {
        "job_id": job_id,
        "pdf_url": pdf_url,
        "status": "UPLOADED",
        "message": "PDF uploaded successfully. Processing started."
    }

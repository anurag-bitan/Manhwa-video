from fastapi import APIRouter, HTTPException
from db.supabase_admin import supabase_admin

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("/{job_id}")
async def get_job_status(job_id: str):
    job = supabase_admin.table("processing_jobs").select("*").eq("id", job_id).execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.data[0]

@router.get("/{job_id}/assets")
async def get_job_assets(job_id: str):
    job = supabase_admin.table("processing_jobs").select("state_json,status").eq("id", job_id).execute()
    if not job.data or not job.data[0].get("state_json"):
        raise HTTPException(status_code=404, detail="Job not found or not finished")
    state = job.data[0]["state_json"]

    scenes = state.get("scenes", [])
    page_urls = state.get("page_urls", [])
    audio_urls = state.get("audio_urls", [])
    timings = state.get("timings", [])
    panels = state.get("panels", [])
    combined_audio = state.get("combined_audio_url", "")

    # Build image list (page images)
    image_urls = [p["url"] for p in page_urls] if page_urls else []

    # Build final_video_segments as expected by frontend
    final_video_segments = []
    for scene in scenes:
        if not scene.get("is_story"):
            continue
        idx = scene["scene_index"]
        # Find panel for this scene (each scene has one panel index)
        panel_idx = scene["panels"][0]
        panel = panels[panel_idx] if panel_idx < len(panels) else {}
        page = page_urls[panel.get("page_number", 0)] if panel else {}
        audio = audio_urls[idx] if idx < len(audio_urls) else ""
        timing = timings[idx] if idx < len(timings) else {"duration": 5}

        final_video_segments.append({
            "image_page_index": panel.get("page_number", 0),  # index into image_urls
            "duration": timing.get("duration", 5),
            "audio_url": audio,  # individual audio (optional, not used by videoMaker)
        })

    return {
        "image_urls": image_urls,
        "audio_url": combined_audio,          # single combined audio
        "final_video_segments": final_video_segments,
        "total_duration": sum(s["duration"] for s in final_video_segments),
    }
const API_URL = import.meta.env.VITE_API_BASE_URL;

async function parseJSON(response) {
  try {
    return await response.json();
  } catch {
    const text = await response.text();
    throw new Error(`Backend returned non-JSON (${response.status}):\n${text}`);
  }
}

// Start a new job
export const generateAudioStory = async (formData) => {
  const res = await fetch(`${API_URL}/jobs/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw await parseJSON(res);
  const data = await res.json();
  return { task_id: data.job_id };
};

// Poll job status
export const checkTaskStatus = async (taskId) => {
  const res = await fetch(`${API_URL}/jobs/${taskId}`);
  if (!res.ok) throw await parseJSON(res);
  const job = await res.json();
  
  // Map your backend statuses to the frontend's expected states
  const status = job.status;
  if (status === "TTS_COMPLETED") {
    // Fetch the assets and return them as result
    const assetsRes = await fetch(`${API_URL}/jobs/${taskId}/assets`);
    if (!assetsRes.ok) throw new Error("Failed to fetch assets");
    const assets = await assetsRes.json();
    return {
      state: "SUCCESS",
      progress: 100,
      result: assets,
    };
  } else if (status === "FAILED") {
    throw new Error(job.state_json?.error || "Job failed");
  } else {
    // Map status to progress percentage
    const progressMap = {
      UPLOADED: 5,
      EXTRACTED: 15,
      PANELS_DETECTED: 30,
      OCR_COMPLETED: 50,
      CHAPTER_DETECTED: 60,
      SCENE_BUILDING: 70,
      SCRIPT_GENERATING: 80,
      // TTS_COMPLETED handled above
    };
    return {
      state: "PROCESSING",
      progress: progressMap[status] || 50,
      result: null,
    };
  }
};
import { fetchAuthSession } from "aws-amplify/auth";


const API_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(payload, status) {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (typeof payload?.detail === "string") return payload.detail;
  if (typeof payload?.message === "string") return payload.message;
  return `Backend request failed (${status})`;
}

async function getAccessToken() {
  try {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken;
    if (!accessToken) throw new Error("No access token");
    return accessToken.toString();
  } catch {
    throw new ApiError("Your session expired. Please sign in again.", 401);
  }
}

async function authenticatedFetch(path, options = {}) {
  if (!API_URL) {
    throw new ApiError("VITE_API_BASE_URL is not configured.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${await getAccessToken()}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response.status), response.status, payload);
  }

  return payload;
}

// Start a new job.
export const generateAudioStory = async (formData) => {
  const data = await authenticatedFetch("/jobs/upload", {
    method: "POST",
    body: formData,
  });
  return { task_id: data.job_id };
};

// Poll a job that belongs to the signed-in Cognito user.
export const checkTaskStatus = async (taskId) => {
  const encodedTaskId = encodeURIComponent(taskId);
  const job = await authenticatedFetch(`/jobs/${encodedTaskId}`);
  const status = job.status;

  if (status === "TTS_COMPLETED") {
    const assets = await authenticatedFetch(`/jobs/${encodedTaskId}/assets`);
    return {
      state: "SUCCESS",
      progress: 100,
      result: assets,
    };
  }

  if (status === "FAILED") {
    return {
      state: "FAILURE",
      progress: 0,
      error: job.state_json?.error || "Job failed",
    };
  }

  const progressMap = {
    UPLOADED: 5,
    EXTRACTED: 15,
    PANELS_DETECTED: 30,
    OCR_COMPLETED: 50,
    CHAPTER_DETECTED: 60,
    SCENE_BUILDING: 70,
    SCRIPT_GENERATING: 80,
  };

  return {
    state: "PROCESSING",
    progress: progressMap[status] || 5,
    result: null,
  };
};

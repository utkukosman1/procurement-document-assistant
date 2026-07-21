const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface DocumentInfo {
  document_id: string;
  filename: string;
  num_pages: number;
  num_chunks: number;
  document_type: string;
}

export interface Citation {
  page_number: number;
  chunk_index: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export class ApiError extends Error {}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError("Could not reach the backend. Is the API server running?");
  }
  if (!response.ok) {
    throw new ApiError(await extractDetail(response));
  }
  return response;
}

async function extractDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return `Request failed with status ${response.status}.`;
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const form = new FormData();
  form.append("file", file);
  const response = await request("/documents", { method: "POST", body: form });
  return response.json();
}

export async function askQuestion(documentId: string, question: string): Promise<ChatResponse> {
  const response = await request("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId, question }),
  });
  return response.json();
}

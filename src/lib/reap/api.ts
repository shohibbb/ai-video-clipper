import { getReapConfig, requireReapApiKey } from "@/lib/reap/config";
import { waitForReapRateLimit } from "@/lib/reap/rate-limit";
import type {
  ReapClip,
  ReapCreateClipsRequest,
  ReapDeleteResponse,
  ReapGetClipsResponse,
  ReapGetIntegrationsResponse,
  ReapGetPresetsResponse,
  ReapProject,
  ReapProjectStatusResponse,
  ReapPublishClipRequest,
  ReapPost,
  ReapUpdateClipRequest,
  ReapUploadUrlResponse,
} from "@/lib/reap/types";

class ReapApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `Reap API error ${status}: ${JSON.stringify(body)}`);
    this.name = "ReapApiError";
  }
}

async function reapRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = getReapConfig();
  const apiKey = requireReapApiKey();
  const url = path.startsWith("http") ? path : `${config.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  await waitForReapRateLimit(apiKey);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => null);
    throw new ReapApiError(
      response.status,
      body,
      `Reap API error ${response.status}: ${path}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function getUploadUrl(filename: string): Promise<ReapUploadUrlResponse> {
  return reapRequest<ReapUploadUrlResponse>("/get-upload-url", {
    method: "POST",
    body: JSON.stringify({ filename }),
  });
}

export async function uploadFileToUrl(uploadUrl: string, fileBuffer: Buffer, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    throw new Error(`Reap file upload failed: ${response.status} ${response.statusText}`);
  }
}

export async function createClips(params: ReapCreateClipsRequest): Promise<ReapProject> {
  return reapRequest<ReapProject>("/create-clips", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getProjectStatus(projectId: string): Promise<ReapProjectStatusResponse> {
  return reapRequest<ReapProjectStatusResponse>(`/get-project-status?projectId=${encodeURIComponent(projectId)}`);
}

export async function getProjectDetails(projectId: string): Promise<ReapProject> {
  return reapRequest<ReapProject>(`/get-project-details?projectId=${encodeURIComponent(projectId)}`);
}

export async function getProjectClips(
  projectId: string,
  page = 1,
  pageSize = 50,
): Promise<ReapGetClipsResponse> {
  const query = `projectId=${encodeURIComponent(projectId)}&page=${page}&pageSize=${pageSize}`;
  return reapRequest<ReapGetClipsResponse>(`/get-project-clips?${query}`);
}

export async function getClipDetails(projectId: string, clipId: string): Promise<ReapClip> {
  const query = `projectId=${encodeURIComponent(projectId)}&clipId=${encodeURIComponent(clipId)}`;
  return reapRequest<ReapClip>(`/get-clip-details?${query}`);
}

export async function getIntegrations(): Promise<ReapGetIntegrationsResponse> {
  return reapRequest<ReapGetIntegrationsResponse>("/get-integrations");
}

export async function publishClip(params: ReapPublishClipRequest): Promise<ReapPost> {
  return reapRequest<ReapPost>("/publish-clip", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getPostDetails(postId: string): Promise<ReapPost> {
  return reapRequest<ReapPost>(`/get-post-details?postId=${encodeURIComponent(postId)}`);
}

export async function updateClip(params: ReapUpdateClipRequest): Promise<ReapClip> {
  return reapRequest<ReapClip>("/update-clip", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function deleteProject(projectId: string): Promise<ReapDeleteResponse> {
  return reapRequest<ReapDeleteResponse>(`/delete-project?projectId=${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}

export async function deleteClip(projectId: string, clipId: string): Promise<ReapDeleteResponse> {
  const query = `projectId=${encodeURIComponent(projectId)}&clipId=${encodeURIComponent(clipId)}`;
  return reapRequest<ReapDeleteResponse>(`/delete-clip?${query}`, {
    method: "DELETE",
  });
}

export async function getAllPresets(page = 1, pageSize = 50): Promise<ReapGetPresetsResponse> {
  return reapRequest<ReapGetPresetsResponse>(`/get-all-presets?page=${page}&pageSize=${pageSize}`);
}

export { ReapApiError };

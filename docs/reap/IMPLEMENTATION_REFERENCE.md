# Reap API — Implementation Reference

> Complete reference for migrating from OpusClip (Playwright) to Reap (REST API).

## Base URL

```
https://public.reap.video/api/v1/automation
```

## Authentication

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

API keys are created at: https://app.reap.video → Profile → Settings → API Keys

## Rate Limits

- 10 requests per minute per API key
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Project Status Values

| Status | Description |
|---|---|
| `queued` | Waiting to be processed |
| `prepped` | Prepared for processing |
| `draft` | Draft state |
| `processing` | Currently being processed |
| `finalizing` | Finalizing output |
| `completed` | Done — clips are ready |
| `invalid` | Source video was invalid |
| `expired` | Results expired |
| `failed` | Processing failed |
| `error` | Internal error |

Terminal states (trigger webhooks): `completed`, `invalid`, `expired`

---

## Core Workflow (MVP)

```
1. POST /get-upload-url → { uploadUrl, id }
2. PUT <uploadUrl> (file binary)
3. POST /create-clips { uploadId, genre, ... } → { id, status: "queued" }
4. [Wait for webhook or poll GET /get-project-status]
5. GET /get-project-clips?projectId=... → [{ id, clipUrl, title, caption, viralityScore, ... }]
6. Download each clipUrl → store to Supabase
7. POST /publish-clip { projectId, clipId, integrations } → publish to TikTok
```

Alternative for YouTube URLs (no upload needed):
```
1. POST /create-clips { sourceUrl: "https://youtube.com/...", genre: "talking" }
2-7. Same as above
```

---

## Endpoints Reference

### Upload Files

#### POST /get-upload-url
```json
// Request
{ "filename": "video.mp4" }
// Response
{ "uploadUrl": "https://...", "id": "upload_abc", "fileName": "video.mp4",
  "fileType": "video", "status": "upload" }
```
Upload file: `PUT <uploadUrl>` with `Content-Type: video/mp4` and binary body.

#### GET /get-all-uploads
Query: `?page=1&pageSize=20`

---

### Create Projects

#### POST /create-clips
```json
// Request body (sourceUrl OR uploadId, not both)
{
  "sourceUrl": "https://youtube.com/...",    // OR "uploadId": "upload_abc"
  "genre": "talking",                        // "talking" | "screenshare" | "gaming"
  "exportOrientation": "portrait",           // "landscape" | "portrait" | "square"
  "exportResolution": 1080,                  // 720 | 1080 | 1440 | 2160
  "reframeClips": true,                       // auto-reframe for aspect ratio
  "captionsPreset": "system_beasty",         // preset ID or null to disable
  "enableEmojis": true,
  "enableHighlights": true,
  "language": "en",                           // auto-detected if omitted
  "clipDurations": [[30,60],[60,90]],        // optional [min,max] pairs
  "topics": ["product launch"]               // optional, guides AI
}
// Response: AutomationProject object with id, status, metadata
```

#### POST /create-captions
```json
{ "uploadId": "...", "sourceUrl": "...", "captionsPreset": "...", "enableEmojis": false, ... }
```

#### POST /create-transcription, POST /create-reframe, POST /create-dubbing
(See OpenAPI spec for details)

---

### Track & Retrieve

#### GET /get-project-status?projectId=...
```json
{ "projectId": "...", "projectType": "clipping", "source": "Upload", "status": "completed" }
```

#### GET /get-project-details?projectId=...
Returns full AutomationProject object.

#### GET /get-project-clips?projectId=...&page=1&pageSize=20
```json
{
  "clips": [{
    "id": "clip_123",
    "projectId": "proj_xyz",
    "clipUrl": "https://cdn.reap.video/...",
    "startTime": 0,
    "endTime": 45.5,
    "duration": 45.5,
    "topic": "key moment",
    "title": "Engaging Moment 1",
    "caption": "AI-generated caption...",
    "viralityScore": 8.7,
    "enableCaptions": true,
    "enableEmojis": true,
    "exportResolution": 1080,
    "exportOrientation": "portrait",
    "metadata": { "width": 1080, "height": 1920, ... }
  }],
  "totalClips": 5
}
```

#### GET /get-clip-details?projectId=...&clipId=...
Single clip detail.

---

### Manage Projects

#### POST /update-clip
```json
{ "projectId": "...", "clipId": "...", "title": "New Title", "caption": "New Caption" }
```
Title max 80 chars, caption max 250 chars.

#### DELETE /delete-project?projectId=...
#### DELETE /delete-clip?projectId=...&clipId=...
#### DELETE /delete-upload?uploadId=...

---

### Publishing

#### GET /get-integrations
```json
{
  "integrations": [{
    "id": "int_abc",
    "platform": "tiktok",
    "isActive": true,
    "username": "@myhandle",
    "name": "My Name",
    "profilePictureUrl": "https://..."
  }]
}
```
Platforms: youtube, instagram, tiktok, linkedin, x

#### POST /publish-clip
```json
{
  "projectId": "...",
  "clipId": "...",
  "integrations": ["int_abc"],          // integration IDs from /get-integrations
  "title": "My Video",
  "description": "Check this out!",
  "tags": ["fyp", "viral"],
  "platformSettings": {
    "tiktok": {
      "privacy": "public",
      "disableComments": false,
      "disableDuet": false,
      "disableStitch": false,
      "brandContent": false,
      "brandOrganic": false
    }
  }
}
```

#### POST /schedule-clips
```json
{
  "projectId": "...",
  "clipIds": ["clip_1", "clip_2"],
  "integrations": ["int_abc"],
  "scheduleDate": 1710345600,            // Unix timestamp
  "title": "...",
  "description": "...",
  "tags": ["fyp"],
  "platformSettings": { ... }
}
```

---

### Presets & Languages

#### GET /get-all-presets?page=1&pageSize=20
Caption style presets (ID needed for `captionsPreset` in create-clips).

#### GET /get-translation-languages
#### GET /get-dubbing-languages

---

## Webhooks

Configure at: https://app.reap.video → Profile → Settings → Webhooks

### Webhook Payload
```json
{ "projectId": "...", "projectType": "clipping", "source": "Upload", "status": "completed" }
```

### Terminal Statuses that Trigger Webhooks
- `completed` — clips ready
- `invalid` — source video invalid
- `expired` — results expired

### Requirements
- HTTPS endpoint, respond 200 with empty body within 5 seconds (validation) / 10 seconds (live)
- 5 consecutive failures → auto-disable
- No retries (design for idempotency, use polling as fallback)

### Plan Limits
| Plan | Max Webhooks |
|---|---|
| Free | 0 |
| Creator | 1 |
| Studio | 5 |

---

## Clip Duration Ranges

| Value | Label |
|---|---|
| `[0, 30]` | Under 30 seconds |
| `[30, 60]` | 30s – 60s |
| `[60, 90]` | 60s – 90s |
| `[90, 180]` | 90s – 3 min |
| `[180, 300]` | 3 – 5 min |

---

## Video Requirements

- Format: MP4 or MOV
- Duration: 2 minutes – 3 hours
- Max file size: 5 GB
- Best for: dialogue-rich content (podcasts, interviews, keynotes)

## Processing Times

| Type | Time |
|---|---|
| Clipping | 5-15 min |
| Captions | 2-5 min |
| Reframe | 3-8 min |
| Dubbing | 10-20 min |

## Concurrent Projects

| Plan | Limit |
|---|---|
| Creator | 3 |
| Studio | 10 |
| Enterprise | Custom |

---

## Environment Variables (to add)

```env
# Reap API
REAP_API_KEY=                               # Required. Bearer token for Reap API
REAP_WEBHOOK_SECRET=                        # Optional. For webhook verification if Reap adds it

# Reap Processing Defaults
REAP_DEFAULT_GENRE=talking                  # talking | screenshare | gaming
REAP_DEFAULT_ORIENTATION=portrait           # landscape | portrait | square
REAP_DEFAULT_RESOLUTION=1080                # 720 | 1080 | 1440 | 2160
REAP_DEFAULT_REFRAME=true                   # auto-reframe clips
REAP_DEFAULT_CAPTIONS_PRESET=system_beasty  # caption preset ID
REAP_DEFAULT_ENABLE_EMOJIS=true
REAP_DEFAULT_ENABLE_HIGHLIGHTS=true
REAP_DEFAULT_LANGUAGE=en
REAP_POLL_INTERVAL_MS=10000                 # 10 seconds (fallback polling)
REAP_POLL_TIMEOUT_MS=900000                  # 15 minutes max wait

# Reap Upload
REAP_MAX_SOURCE_VIDEO_UPLOAD_MB=500         # max upload size in MB
```

---

## Environment Variables (to remove)

```env
# Remove all OPUSCLIP_* variables (~27 vars)
# Remove all COMPOSIO_* variables (~12 vars)
```

---

## Database Schema Changes

### VideoStatus enum — revised
```
pending → uploading_to_reap → processing_in_reap → downloading_from_reap → ready_to_upload → completed
                                                                ↘ failed
                                                                 ↘ cancelled
```

Remove: `uploading_to_opusclip`, `processing_in_opusclip`

### Clip model — add fields
- `reapClipId String?` — Reap clip ID
- `viralityScore Float?` — 0-10 score from Reap
- `sourceStartTime Float?` — startTime from Reap clip
- `sourceEndTime Float?` — endTime from Reap clip

### Video model — add fields
- `reapProjectId String?` — Reap project ID

### JobType enum — replace
- Remove: `opusclip_process`, `upload_tiktok`
- Add: `reap_process`, `reap_publish`

---

## Key Type Definitions (TypeScript)

```typescript
type ReapProjectStatus =
  | "queued" | "prepped" | "draft" | "processing" | "finalizing"
  | "completed" | "invalid" | "expired" | "failed" | "error";

type ReapProjectType = "clipping" | "captions" | "reframe" | "dubbing" | "transcription";

type ReapSource = "Upload" | "Youtube" | "Vimeo" | "TwitchVod" | "Twitter" | "RumbleEmbed" | "Generic";

type ReapGenre = "talking" | "screenshare" | "gaming";
type ReapOrientation = "landscape" | "portrait" | "square";
type ReapResolution = 720 | 1080 | 1440 | 2160;
type ReapTranscriptionScript = "native" | "roman";

interface ReapCreateClipsRequest {
  sourceUrl?: string;
  uploadId?: string;
  genre?: ReapGenre;
  exportOrientation?: ReapOrientation;
  exportResolution?: ReapResolution;
  reframeClips?: boolean;
  captionsPreset?: string | null;
  enableEmojis?: boolean;
  enableHighlights?: boolean;
  language?: string | null;
  translationLanguage?: string | null;
  transcriptionScript?: ReapTranscriptionScript;
  selectedStart?: number | null;
  selectedEnd?: number | null;
  clipDurations?: number[][];
  topics?: string[];
}

interface ReapProject {
  id: string;
  title: string;
  thumbnail?: string;
  billedDuration?: number;
  status: ReapProjectStatus;
  projectType: ReapProjectType;
  source: ReapSource;
  genre: ReapGenre;
  topics?: string[];
  clipDurations?: number[][];
  selectedStart?: number | null;
  selectedEnd?: number | null;
  reframeClips: boolean;
  exportResolution: number;
  exportOrientation: ReapOrientation;
  captionsPreset?: string | null;
  enableCaptions: boolean;
  enableEmojis: boolean;
  enableHighlights: boolean;
  language?: string | null;
  dubbingLanguage?: string | null;
  translateTranscription: boolean;
  translationLanguages?: string[];
  transcriptionScript: ReapTranscriptionScript;
  metadata?: ReapVideoFileMeta;
  urls?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

interface ReapClip {
  id: string;
  projectId: string;
  clipUrl?: string | null;          // DOWNLOAD URL — key for our MVP
  clipWithCaptionsUrl?: string | null; // deprecated, use clipUrl
  startTime: number;
  endTime: number;
  duration: number;
  topic?: string | null;
  title?: string | null;
  caption?: string | null;
  language?: string | null;
  viralityScore?: number | null;     // 0-10
  reframeClips: boolean;
  exportResolution: number;
  exportOrientation: ReapOrientation;
  captionsPreset?: string | null;
  enableCaptions: boolean;
  enableEmojis: boolean;
  enableHighlights: boolean;
  metadata?: ReapVideoFileMeta;
  createdAt: number;
  updatedAt: number;
}

interface ReapUploadUrlResponse {
  uploadUrl: string;
  id: string;
  fileName: string;
  fileType: "video" | "audio" | "image";
  fileSize?: number | null;
  contentType?: string | null;
  status: "upload" | "verified" | "rejected";
  createdAt: number;
  updatedAt: number;
}

interface ReapIntegration {
  id: string;
  platform: "youtube" | "instagram" | "tiktok" | "linkedin" | "x";
  isActive: boolean;
  username: string;
  name: string;
  profilePictureUrl?: string;
}

interface ReapPublishClipRequest {
  projectId: string;
  clipId: string;
  integrations: string[];
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  platformSettings?: {
    youtube?: { privacy?: "public"|"unlisted"|"private"; embeddable?: boolean; publicStats?: boolean; madeForKids?: boolean };
    tiktok?: { privacy?: "public"|"friends"|"private"; disableComments?: boolean; disableDuet?: boolean; disableStitch?: boolean; brandContent?: boolean; brandOrganic?: boolean };
    instagram?: { shareToFeed?: boolean };
    linkedin?: { privacy?: "public"|"connections" };
  };
}

interface ReapWebhookPayload {
  projectId: string;
  projectType: ReapProjectType;
  source: ReapSource;
  status: "completed" | "invalid" | "expired";
}
```

---

## OpenAPI Spec

The full OpenAPI 3.1 spec is saved at `docs/reap/openapi.json`.
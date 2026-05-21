export type ReapProjectStatus =
  | "queued"
  | "prepped"
  | "draft"
  | "processing"
  | "finalizing"
  | "completed"
  | "invalid"
  | "expired"
  | "failed"
  | "error";

export type ReapProjectType = "clipping" | "captions" | "reframe" | "dubbing" | "transcription";

export type ReapSource = "Upload" | "Youtube" | "Vimeo" | "TwitchVod" | "Twitter" | "RumbleEmbed" | "Generic";

export type ReapGenre = "talking" | "screenshare" | "gaming";

export type ReapOrientation = "landscape" | "portrait" | "square";

export type ReapTranscriptionScript = "native" | "roman";

export type ReapVideoFileMeta = {
  width?: number;
  height?: number;
  aspectRatio?: string;
  size?: number;
  bitrate?: number;
  fps?: number;
  duration?: number;
  rotation?: number;
  resolution?: number;
  codec?: string;
  codecFullName?: string;
  codecTag?: string;
  format?: string;
  formatFullName?: string;
};

export type ReapCreateClipsRequest = {
  sourceUrl?: string;
  uploadId?: string;
  genre?: ReapGenre;
  exportOrientation?: ReapOrientation;
  exportResolution?: number;
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
};

export type ReapProject = {
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
};

export type ReapProjectStatusResponse = {
  projectId: string;
  projectType: ReapProjectType;
  source: ReapSource;
  status: ReapProjectStatus;
};

export type ReapClip = {
  id: string;
  projectId: string;
  clipUrl?: string | null;
  clipWithCaptionsUrl?: string | null;
  startTime: number;
  endTime: number;
  duration: number;
  topic?: string | null;
  title?: string | null;
  caption?: string | null;
  language?: string | null;
  translateTranscription: boolean;
  translationLanguages?: string[];
  transcriptionScript: ReapTranscriptionScript;
  viralityScore?: number | null;
  reframeClips: boolean;
  exportResolution: number;
  exportOrientation: ReapOrientation;
  captionsPreset?: string | null;
  enableCaptions: boolean;
  enableEmojis: boolean;
  enableHighlights: boolean;
  dubbingLanguage?: string | null;
  metadata?: ReapVideoFileMeta;
  createdAt: number;
  updatedAt: number;
};

export type ReapGetClipsResponse = {
  clips: ReapClip[];
  currentPage: number;
  totalPages: number;
  totalClips: number;
};

export type ReapUploadUrlResponse = {
  uploadUrl: string;
  id: string;
  fileName: string;
  fileType: "video" | "audio" | "image";
  fileSize?: number | null;
  contentType?: string | null;
  status: "upload" | "verified" | "rejected";
  createdAt: number;
  updatedAt: number;
};

export type ReapIntegration = {
  id: string;
  platform: "youtube" | "instagram" | "tiktok" | "linkedin" | "x";
  isActive: boolean;
  username: string;
  name: string;
  profilePictureUrl?: string;
};

export type ReapGetIntegrationsResponse = {
  integrations: ReapIntegration[];
};

export type ReapPublishClipRequest = {
  projectId: string;
  clipId: string;
  integrations: string[];
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  platformSettings?: {
    youtube?: {
      privacy?: "public" | "unlisted" | "private";
      embeddable?: boolean;
      publicStats?: boolean;
      madeForKids?: boolean;
    };
    tiktok?: {
      privacy?: "public" | "friends" | "private";
      disableComments?: boolean;
      disableDuet?: boolean;
      disableStitch?: boolean;
      brandContent?: boolean;
      brandOrganic?: boolean;
    };
    instagram?: {
      shareToFeed?: boolean;
    };
    linkedin?: {
      privacy?: "public" | "connections";
    };
  };
};

export type ReapPost = {
  id: string;
  projectId?: string | null;
  clipId?: string | null;
  platforms: string[];
  successPlatforms: string[];
  failedPlatforms: string[];
  integrations: string[];
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  status: "processing" | "draft" | "completed" | "failed" | "cancelled" | "unresolved";
  scheduleType?: "scheduled" | "immediate";
  scheduleDate?: number;
  publishDate?: number;
  urls?: Record<string, string>;
  platformSettings?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type ReapWebhookPayload = {
  projectId: string;
  projectType: ReapProjectType;
  source: ReapSource;
  status: "completed" | "invalid" | "expired";
};

export type ReapDeleteResponse = {
  success: boolean;
  message?: string;
};

export type ReapPreset = {
  id: string;
  name: string;
  source: "system" | "user";
  preferences: {
    addAudiogram?: boolean;
    addCaptions?: boolean;
    genre?: ReapGenre;
    language?: string;
    translationLanguage?: string | null;
    transcriptionScript?: ReapTranscriptionScript;
    orientation?: ReapOrientation;
    resolution?: number;
    clipDurations?: number[][];
  };
};

export type ReapGetPresetsResponse = {
  presets: ReapPreset[];
  currentPage: number;
  totalPages: number;
  totalPresets: number;
};

export type ReapUpdateClipRequest = {
  projectId: string;
  clipId: string;
  title?: string | null;
  caption?: string | null;
};
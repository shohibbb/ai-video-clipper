import { NextResponse } from "next/server";
import { z } from "zod";
import { reapClippingConfigSchema } from "@/lib/reap/clipping-config";

export function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeHashtags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}

const allowedVideoExtensions = ["mp4", "mov", "webm"] as const;
const allowedVideoMimeTypes = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/mov",
];
const defaultMaxSourceVideoUploadMb = 50;

export type AllowedVideoExtension = (typeof allowedVideoExtensions)[number];

export function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ?? "";
}

export function isAllowedVideoExtension(
  extension: string,
): extension is AllowedVideoExtension {
  return allowedVideoExtensions.includes(extension as AllowedVideoExtension);
}

export function isAllowedVideoFile(file: File) {
  return isAllowedVideoFileMetadata(file.name, file.type);
}

export function isAllowedVideoFileMetadata(
  fileName: string,
  contentType?: string | null,
) {
  const extension = getFileExtension(fileName);

  if (!isAllowedVideoExtension(extension)) {
    return false;
  }

  return !contentType || allowedVideoMimeTypes.includes(contentType);
}

export function getAllowedVideoFileTypesLabel() {
  return allowedVideoExtensions.map((extension) => `.${extension}`).join(", ");
}

export function getMaxSourceVideoUploadBytes() {
  const value = Number(
    process.env.MAX_SOURCE_VIDEO_UPLOAD_MB ?? defaultMaxSourceVideoUploadMb,
  );
  const maxMb =
    Number.isFinite(value) && value > 0 ? value : defaultMaxSourceVideoUploadMb;

  return maxMb * 1024 * 1024;
}

export function getMaxSourceVideoUploadLabel() {
  return `${Math.round(getMaxSourceVideoUploadBytes() / 1024 / 1024)} MB`;
}

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use http or https.");

const authEmailSchema = z
  .string()
  .trim()
  .max(255)
  .email()
  .transform((value) => value.toLowerCase());

export const registerRequestSchema = z.strictObject({
  name: z.string().trim().max(120).optional().nullable(),
  email: authEmailSchema,
  password: z.string().min(8).max(128),
});

export const manualLoginRequestSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1).max(128),
});

export const createVideoUrlRequestSchema = z.strictObject({
  sourceType: z.literal("url"),
  sourceUrl: httpUrlSchema,
  title: z.string().trim().max(200).optional().nullable(),
  platformTargets: z.array(z.literal("tiktok")).optional().default(["tiktok"]),
});

export const createVideoFileFieldsSchema = z.strictObject({
  sourceType: z.literal("file"),
  title: z.string().trim().max(200).optional().nullable(),
  platform: z.literal("tiktok").optional().default("tiktok"),
});

export const createVideoSignedUploadRequestSchema = z.strictObject({
  sourceType: z.literal("file"),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  contentType: z.string().trim().max(120).optional().nullable(),
  title: z.string().trim().max(200).optional().nullable(),
  platform: z.literal("tiktok").optional().default("tiktok"),
});

export const completeVideoFileUploadRequestSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  contentType: z.string().trim().max(120).optional().nullable(),
});

export const startClippingRequestSchema = reapClippingConfigSchema;

export const updateClipMetadataRequestSchema = z
  .strictObject({
    title: z.string().trim().max(160).optional().nullable(),
    caption: z.string().trim().max(2200).optional().nullable(),
    hashtags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.caption !== undefined ||
      value.hashtags !== undefined,
    {
      message: "At least one metadata field is required.",
    },
  );

export const uploadClipRequestSchema = z.object({
  platform: z.enum(["tiktok", "instagram"]).optional().default("tiktok"),
  connectedAccountIds: z.array(z.string().uuid()).optional().nullable(),
});

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

export function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Invalid request body.",
      details: formatZodError(error),
    },
    { status: 400 },
  );
}

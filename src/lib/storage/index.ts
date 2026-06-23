import { CloudflareR2StorageAdapter } from "@/lib/storage/cloudflare-r2-storage-adapter";
import { SupabaseStorageAdapter } from "@/lib/storage/supabase-storage-adapter";
import type { StorageProvider, StorageService } from "@/lib/storage/types";

let storageService: StorageService | null = null;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for storage operations.`);
  }

  return value;
}

function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "supabase";

  if (provider !== "supabase" && provider !== "cloudflare-r2") {
    throw new Error(`Unsupported STORAGE_PROVIDER "${provider}". Use "supabase" or "cloudflare-r2".`);
  }

  return provider;
}

export function getStorageService(): StorageService {
  if (storageService) {
    return storageService;
  }

  const provider = getStorageProvider();

  if (provider === "supabase") {
    storageService = new SupabaseStorageAdapter({
      supabaseUrl: requireEnv("SUPABASE_URL"),
      serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "clips",
    });
  } else if (provider === "cloudflare-r2") {
    storageService = new CloudflareR2StorageAdapter({
      accountId: requireEnv("CLOUDFLARE_R2_ACCOUNT_ID"),
      accessKeyId: requireEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
      bucket: process.env.CLOUDFLARE_R2_BUCKET ?? "ai-video-clipper",
      publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL,
    });
  }

  if (!storageService) {
    throw new Error("Storage service could not be initialized.");
  }

  return storageService;
}

export type {
  DownloadFileResult,
  PublicUrlResult,
  SignedUploadUrlResult,
  SignedUrlResult,
  StorageService,
  UploadFileInput,
  UploadFileResult,
} from "@/lib/storage/types";

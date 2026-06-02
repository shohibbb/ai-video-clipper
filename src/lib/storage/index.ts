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

  if (provider !== "supabase") {
    throw new Error(`Unsupported STORAGE_PROVIDER "${provider}". Supabase is the only Phase 3 adapter.`);
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
  }

  if (!storageService) {
    throw new Error("Storage service could not be initialized.");
  }

  return storageService;
}

export type {
  DownloadFileResult,
  SignedUploadUrlResult,
  SignedUrlResult,
  StorageService,
  UploadFileInput,
  UploadFileResult,
} from "@/lib/storage/types";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DownloadFileResult,
  SignedUrlResult,
  SignedUploadUrlResult,
  StorageService,
  UploadFileInput,
  UploadFileResult,
} from "@/lib/storage/types";

type SupabaseStorageConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
};

export class SupabaseStorageAdapter implements StorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(config: SupabaseStorageConfig) {
    this.bucket = config.bucket;
    this.client = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async uploadFile({
    path,
    file,
    contentType,
    cacheControl = "3600",
    upsert = false,
  }: UploadFileInput): Promise<UploadFileResult> {
    const { data, error } = await this.client.storage.from(this.bucket).upload(path, file, {
      cacheControl,
      contentType,
      upsert,
    });

    if (error) {
      throw new Error(`Supabase upload failed for ${path}: ${error.message}`);
    }

    return {
      path: data.path,
      bucket: this.bucket,
    };
  }

  async downloadFile(path: string): Promise<DownloadFileResult> {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);

    if (error) {
      throw new Error(`Supabase download failed for ${path}: ${error.message}`);
    }

    return {
      path,
      data,
    };
  }

  async getSignedUrl(path: string, expiresInSeconds = 60 * 60): Promise<SignedUrlResult> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);

    if (error) {
      throw new Error(`Supabase signed URL failed for ${path}: ${error.message}`);
    }

    return {
      path,
      signedUrl: data.signedUrl,
      expiresInSeconds,
    };
  }

  async createSignedUploadUrl(path: string, options: { upsert?: boolean } = {}): Promise<SignedUploadUrlResult> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(path, {
      upsert: options.upsert ?? false,
    });

    if (error) {
      throw new Error(`Supabase signed upload URL failed for ${path}: ${error.message}`);
    }

    return {
      path: data.path,
      signedUrl: data.signedUrl,
      token: data.token,
      expiresInSeconds: 60 * 60 * 2,
    };
  }

  async fileExists(path: string): Promise<boolean> {
    const { data, error } = await this.client.storage.from(this.bucket).exists(path);

    if (error && data !== false) {
      throw new Error(`Supabase exists check failed for ${path}: ${error.message}`);
    }

    return data;
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);

    if (error) {
      throw new Error(`Supabase delete failed for ${path}: ${error.message}`);
    }
  }
}

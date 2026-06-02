export type StorageProvider = "supabase";

export type UploadFileInput = {
  path: string;
  file: Blob | ArrayBuffer | Uint8Array | Buffer;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
};

export type UploadFileResult = {
  path: string;
  bucket: string;
};

export type DownloadFileResult = {
  path: string;
  data: Blob;
  contentType?: string;
};

export type SignedUrlResult = {
  path: string;
  signedUrl: string;
  expiresInSeconds: number;
};

export type SignedUploadUrlResult = {
  path: string;
  signedUrl: string;
  token: string;
  expiresInSeconds: number;
};

export interface StorageService {
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  downloadFile(path: string): Promise<DownloadFileResult>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<SignedUrlResult>;
  createSignedUploadUrl(path: string, options?: { upsert?: boolean }): Promise<SignedUploadUrlResult>;
  fileExists(path: string): Promise<boolean>;
  deleteFile(path: string): Promise<void>;
}

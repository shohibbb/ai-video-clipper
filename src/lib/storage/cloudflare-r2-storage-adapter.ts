import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  DownloadFileResult,
  PublicUrlResult,
  SignedUrlResult,
  SignedUploadUrlResult,
  StorageService,
  UploadFileInput,
  UploadFileResult,
} from "@/lib/storage/types";

type R2StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl?: string;
};

export class CloudflareR2StorageAdapter implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase: string;

  constructor(config: R2StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrlBase =
      config.publicUrl ??
      `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestHandler: {
        requestTimeout: 30_000,
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
    const body =
      file instanceof Blob
        ? Buffer.from(await file.arrayBuffer())
        : Buffer.from(file as ArrayBuffer);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: body,
        ContentType: contentType,
        CacheControl: `max-age=${cacheControl}`,
      }),
    );

    return { path, bucket: this.bucket };
  }

  async downloadFile(path: string): Promise<DownloadFileResult> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );

    const body = await response.Body!.transformToByteArray();
    const data = new Blob([body as BlobPart], { type: response.ContentType });

    return { path, data, contentType: response.ContentType };
  }

  async getSignedUrl(
    path: string,
    expiresInSeconds = 60 * 60,
  ): Promise<SignedUrlResult> {
    const signedUrl = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
      { expiresIn: expiresInSeconds },
    );

    return { path, signedUrl, expiresInSeconds };
  }

  async createSignedUploadUrl(path: string): Promise<SignedUploadUrlResult> {
    const signedUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
      { expiresIn: 60 * 60 * 2 },
    );

    return {
      path,
      signedUrl,
      token: "",
      expiresInSeconds: 60 * 60 * 2,
    };
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: path,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
  }

  async getPublicUrl(path: string): Promise<PublicUrlResult> {
    return {
      publicUrl: `${this.publicUrlBase}/${path}`,
    };
  }
}

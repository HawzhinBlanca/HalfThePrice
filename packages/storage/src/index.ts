import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface KycUploadResult {
  storage: "minio" | "local";
  key: string;
  filePath: string;
}

export interface StorageConfig {
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  region?: string;
  localDir?: string;
}

function getConfig(): StorageConfig {
  return {
    endpoint: process.env.MINIO_ENDPOINT,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET ?? "htp-kyc",
    region: process.env.MINIO_REGION ?? "us-east-1",
    localDir: process.env.KYC_UPLOAD_DIR,
  };
}

export function isMinioConfigured(config: StorageConfig = getConfig()): boolean {
  return Boolean(config.endpoint && config.accessKey && config.secretKey);
}

function createS3Client(config: StorageConfig): S3Client {
  if (!config.endpoint || !config.accessKey || !config.secretKey) {
    throw new Error("MinIO is not configured.");
  }

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region ?? "us-east-1",
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });
}

export async function checkMinioHealth(
  config: StorageConfig = getConfig(),
): Promise<{ ok: boolean; message: string }> {
  if (!isMinioConfigured(config)) {
    return { ok: false, message: "MinIO not configured" };
  }

  try {
    const client = createS3Client(config);
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return { ok: true, message: "MinIO reachable" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MinIO unreachable";
    return { ok: false, message };
  }
}

async function ensureBucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function uploadKycDocument(params: {
  key: string;
  body: Buffer;
  mimeType: string;
  config?: StorageConfig;
}): Promise<KycUploadResult> {
  const config = params.config ?? getConfig();

  if (isMinioConfigured(config)) {
    const client = createS3Client(config);
    const bucket = config.bucket ?? "htp-kyc";
    await ensureBucket(client, bucket);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.mimeType,
      }),
    );

    return {
      storage: "minio",
      key: params.key,
      filePath: `s3://${bucket}/${params.key}`,
    };
  }

  const uploadDir =
    config.localDir ?? path.join(process.cwd(), "uploads", "kyc");
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, params.key);
  await writeFile(filePath, params.body);

  return {
    storage: "local",
    key: params.key,
    filePath: params.key,
  };
}

export async function getKycPresignedUrl(
  key: string,
  expiresIn = 3600,
  config: StorageConfig = getConfig(),
): Promise<string | null> {
  if (!isMinioConfigured(config)) return null;

  const client = createS3Client(config);
  const bucket = config.bucket ?? "htp-kyc";

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "application/octet-stream",
    }),
    { expiresIn },
  );
}

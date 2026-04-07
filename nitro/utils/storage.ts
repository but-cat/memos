import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3Config {
  endpoint?: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  urlPrefix?: string;
  presignedUrlTimeout?: number; // seconds, default 3600
}

let _s3Client: S3Client | null = null;
let _s3Config: S3Config | null = null;

export function initS3(config: S3Config) {
  _s3Config = config;
  _s3Client = new S3Client({
    region: config.region || "us-east-1",
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: !!config.endpoint, // needed for MinIO/self-hosted
  });
}

export function getS3Client(): { client: S3Client; config: S3Config } {
  if (!_s3Client || !_s3Config) {
    throw new Error("S3 not initialized. Call initS3() first.");
  }
  return { client: _s3Client, config: _s3Config };
}

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const { client, config } = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  if (config.urlPrefix) {
    return `${config.urlPrefix.replace(/\/$/, "")}/${key}`;
  }

  return key;
}

export async function getPresignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const { client, config } = getS3Client();
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteFromS3(key: string): Promise<void> {
  const { client, config } = getS3Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}

export async function refreshPresignedUrls(
  references: { uid: string; reference: string }[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  for (const { uid, reference } of references) {
    try {
      const newUrl = await getPresignedUrl(reference, expiresIn);
      results.set(uid, newUrl);
    } catch (error) {
      console.error(
        `[storage] Failed to refresh presigned URL for ${uid}:`,
        error,
      );
    }
  }
  return results;
}

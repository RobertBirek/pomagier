import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { decryptSecret } from "./backup-crypto";
import { getDb, schema } from "../db/index";
import { eq } from "drizzle-orm";

interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

export async function getS3Config(): Promise<S3Config | null> {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.config);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    if (!map.s3_endpoint || !map.s3_bucket || !map.s3_access_key) return null;
    return {
      endpoint: map.s3_endpoint,
      bucket: map.s3_bucket,
      region: map.s3_region || "us-east-1",
      accessKey: map.s3_access_key,
      secretKey: map.s3_secret_key ? decryptSecret(map.s3_secret_key) : "",
    };
  } catch {
    return null;
  }
}

function getClient(config: S3Config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true,
  });
}

export async function uploadToS3(filename: string, data: Buffer): Promise<void> {
  const config = await getS3Config();
  if (!config) throw new Error("S3 not configured");
  const client = getClient(config);
  await client.send(
    new PutObjectCommand({ Bucket: config.bucket, Key: `backups/${filename}`, Body: data }),
  );
}

export async function listS3Files(): Promise<string[]> {
  const config = await getS3Config();
  if (!config) return [];
  const client = getClient(config);
  const result = await client.send(
    new ListObjectsV2Command({ Bucket: config.bucket, Prefix: "backups/" }),
  );
  return (result.Contents || []).map((o) => o.Key?.replace("backups/", "") || "").filter(Boolean);
}

export async function downloadFromS3(filename: string): Promise<Buffer> {
  const config = await getS3Config();
  if (!config) throw new Error("S3 not configured");
  const client = getClient(config);
  const result = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: `backups/${filename}` }),
  );
  return Buffer.from(await result.Body!.transformToByteArray());
}

export async function deleteFromS3(filename: string): Promise<void> {
  const config = await getS3Config();
  if (!config) return;
  const client = getClient(config);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: `backups/${filename}` }));
}

export async function testS3Connection(config: S3Config): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getClient(config);
    await client.send(new ListObjectsV2Command({ Bucket: config.bucket, MaxKeys: 1 }));
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

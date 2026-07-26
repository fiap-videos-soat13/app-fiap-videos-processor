import { S3Client } from '@aws-sdk/client-s3';
import { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';
import { S3VideoStorage } from '@adapter/infra/storage/S3VideoStorage';

export type StorageBackend = 'minio' | 's3';

export function resolveStorageBackend(): StorageBackend {
  const value = process.env.STORAGE_BACKEND?.trim().toLowerCase();
  if (value === 's3') {
    return 's3';
  }
  if (value === 'minio') {
    return 'minio';
  }
  throw new Error(
    'STORAGE_BACKEND must be "minio" (local) or "s3" (AWS production)',
  );
}

function requireBucket(): string {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error('S3_BUCKET is required');
  }
  return bucket;
}

function createS3Client(backend: StorageBackend): S3Client {
  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.S3_REGION?.trim() ||
    (backend === 'minio' ? 'us-east-1' : 'sa-east-1');

  if (backend === 'minio') {
    const endpoint = process.env.S3_ENDPOINT?.trim();
    if (!endpoint) {
      throw new Error('S3_ENDPOINT is required when STORAGE_BACKEND=minio');
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when STORAGE_BACKEND=minio',
      );
    }

    return new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return new S3Client({ region });
}

export function createVideoStorage(): VideoStoragePort {
  const backend = resolveStorageBackend();
  return new S3VideoStorage(createS3Client(backend), requireBucket());
}

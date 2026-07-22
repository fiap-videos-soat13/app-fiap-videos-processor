import { S3Client } from '@aws-sdk/client-s3';
import { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';
import { LocalVideoStorage } from '@adapter/infra/storage/LocalVideoStorage';
import { S3VideoStorage } from '@adapter/infra/storage/S3VideoStorage';

export type StorageBackend = 'local' | 's3';

export function resolveStorageBackend(): StorageBackend {
  const value = process.env.STORAGE_BACKEND?.trim().toLowerCase();
  if (value === 's3') {
    return 's3';
  }
  return 'local';
}

function createS3Client(): S3Client {
  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.S3_REGION?.trim() ||
    'sa-east-1';
  const endpoint = process.env.S3_ENDPOINT?.trim();

  return new S3Client({
    region,
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: true,
        }
      : {}),
  });
}

export function createVideoStorage(): VideoStoragePort {
  if (resolveStorageBackend() === 's3') {
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) {
      throw new Error('S3_BUCKET is required when STORAGE_BACKEND=s3');
    }
    return new S3VideoStorage(createS3Client(), bucket);
  }

  const storagePath = process.env.STORAGE_PATH?.trim() || './storage';
  return new LocalVideoStorage(storagePath);
}

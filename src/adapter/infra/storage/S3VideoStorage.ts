import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';

export class S3VideoStorage extends VideoStoragePort {
  private readonly tempRoot: string;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {
    super();
    this.tempRoot = path.join(os.tmpdir(), 'fiap-videos-processor');
  }

  async resolveVideoPath(storageKey: string): Promise<string> {
    const localPath = path.join(this.tempRoot, storageKey);
    await mkdir(path.dirname(localPath), { recursive: true });
    await this.downloadObject(storageKey, localPath);
    return localPath;
  }

  async buildZipPath(jobId: string): Promise<{
    zipStorageKey: string;
    fullPath: string;
  }> {
    const zipStorageKey = `${jobId}.zip`;
    const fullPath = path.join(this.tempRoot, 'zips', zipStorageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    return { zipStorageKey, fullPath };
  }

  async finalizeZip(
    zipStorageKey: string,
    localZipPath: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `zips/${zipStorageKey}`,
        Body: createReadStream(localZipPath),
        ContentType: 'application/zip',
      }),
    );

    await rm(localZipPath, { force: true });
  }

  private async downloadObject(key: string, destination: string): Promise<void> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Objeto de vídeo vazio no S3: ${key}`);
    }

    await pipeline(
      response.Body as NodeJS.ReadableStream,
      createWriteStream(destination),
    );
  }
}

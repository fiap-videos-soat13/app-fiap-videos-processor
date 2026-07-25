import path from 'node:path';
import { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';

export class LocalVideoStorage extends VideoStoragePort {
  constructor(private readonly storagePath: string) {
    super();
  }

  resolveVideoPath(storageKey: string): string {
    return path.join(this.storagePath, storageKey);
  }

  buildZipPath(jobId: string): { zipStorageKey: string; fullPath: string } {
    const zipStorageKey = path.join('zips', `${jobId}.zip`);
    const fullPath = path.join(this.storagePath, zipStorageKey);
    return { zipStorageKey, fullPath };
  }
}

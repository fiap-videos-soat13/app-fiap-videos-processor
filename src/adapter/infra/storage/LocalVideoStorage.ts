import path from 'node:path';
import { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';

export class LocalVideoStorage extends VideoStoragePort {
  constructor(private readonly basePath: string) {
    super();
  }

  resolveVideoPath(storageKey: string): string {
    return path.join(this.basePath, storageKey);
  }

  buildZipPath(jobId: string): {
    zipStorageKey: string;
    fullPath: string;
  } {
    const zipStorageKey = `${jobId}.zip`;
    return {
      zipStorageKey,
      fullPath: path.join(this.basePath, 'zips', zipStorageKey),
    };
  }
}

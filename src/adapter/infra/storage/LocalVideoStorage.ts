import path from 'node:path';
import { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';

export class LocalVideoStorage extends VideoStoragePort {
  constructor(private readonly basePath: string) {
    super();
  }

  resolveVideoPath(storageKey: string): Promise<string> {
    return Promise.resolve(path.join(this.basePath, storageKey));
  }

  buildZipPath(jobId: string): Promise<{
    zipStorageKey: string;
    fullPath: string;
  }> {
    const zipStorageKey = `${jobId}.zip`;
    return Promise.resolve({
      zipStorageKey,
      fullPath: path.join(this.basePath, 'zips', zipStorageKey),
    });
  }

  finalizeZip(
    _zipStorageKey: string,
    _localZipPath: string,
  ): Promise<void> {
    void _zipStorageKey;
    void _localZipPath;
    return Promise.resolve();
  }
}

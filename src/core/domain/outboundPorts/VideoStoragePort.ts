export abstract class VideoStoragePort {
  abstract resolveVideoPath(storageKey: string): Promise<string>;

  abstract buildZipPath(jobId: string): Promise<{
    zipStorageKey: string;
    fullPath: string;
  }>;

  abstract finalizeZip(
    zipStorageKey: string,
    localZipPath: string,
  ): Promise<void>;
}

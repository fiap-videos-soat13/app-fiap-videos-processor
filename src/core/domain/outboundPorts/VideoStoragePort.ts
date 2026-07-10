export abstract class VideoStoragePort {
  abstract resolveVideoPath(storageKey: string): string;
  abstract buildZipPath(jobId: string): {
    zipStorageKey: string;
    fullPath: string;
  };
}

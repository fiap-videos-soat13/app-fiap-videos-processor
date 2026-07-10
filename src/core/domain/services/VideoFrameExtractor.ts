export abstract class VideoFrameExtractor {
  abstract extractFramesToZip(
    videoPath: string,
    zipPath: string,
  ): Promise<void>;
}

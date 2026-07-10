import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { VideoFrameExtractor } from '@domain/services/VideoFrameExtractor';

const execFileAsync = promisify(execFile);

export class FfmpegFrameExtractor extends VideoFrameExtractor {
  constructor(private readonly ffmpegPath: string) {
    super();
  }

  async extractFramesToZip(videoPath: string, zipPath: string): Promise<void> {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'fiap-frames-'));
    const framesPattern = path.join(tempDir, 'frame-%04d.jpg');

    try {
      await this.extractFrames(videoPath, framesPattern, tempDir);
      await mkdir(path.dirname(zipPath), { recursive: true });
      await this.zipDirectory(tempDir, zipPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async extractFrames(
    videoPath: string,
    framesPattern: string,
    tempDir: string,
  ): Promise<void> {
    const baseArgs = [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      videoPath,
      '-map',
      '0:v:0',
      '-an',
    ];

    const strategies = [
      ['-vf', 'fps=1,format=yuvj420p', '-q:v', '2'],
      ['-vf', 'format=yuvj420p', '-q:v', '2', '-r', '1'],
    ];

    for (const strategy of strategies) {
      await this.clearJpegFrames(tempDir);
      await execFileAsync(this.ffmpegPath, [
        ...baseArgs,
        ...strategy,
        framesPattern,
      ]);
      if (await this.hasJpegFrames(tempDir)) {
        return;
      }
    }

    throw new Error('Nenhum frame extraído do vídeo');
  }

  private async clearJpegFrames(dir: string): Promise<void> {
    const files = await readdir(dir);
    await Promise.all(
      files
        .filter((file) => file.endsWith('.jpg'))
        .map((file) => rm(path.join(dir, file), { force: true })),
    );
  }

  private async hasJpegFrames(dir: string): Promise<boolean> {
    const files = await readdir(dir);
    return files.some((file) => file.endsWith('.jpg'));
  }

  private async zipDirectory(dir: string, zipPath: string): Promise<void> {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.jpg'));
    if (files.length === 0) {
      throw new Error('Nenhum frame extraído do vídeo');
    }

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err: Error) => reject(err));

      archive.pipe(output);
      for (const file of files) {
        archive.file(path.join(dir, file), { name: file });
      }
      void archive.finalize();
    });
  }
}

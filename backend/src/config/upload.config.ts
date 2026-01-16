import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export const UPLOAD_CONFIG = {
  baseDir: join(process.cwd(), 'uploads'),
  videosDir: join(process.cwd(), 'uploads', 'videos'),
  screenshotsDir: join(process.cwd(), 'uploads', 'screenshots'),
  maxFileSize: 100 * 1024 * 1024, // 100MB per video
  allowedFormats: ['webm', 'mp4'],
  retentionDays: 30, // Keep videos for 30 days
};

// Ensure directories exist on startup
export function ensureUploadDirs() {
  const dirs = [
    UPLOAD_CONFIG.baseDir,
    UPLOAD_CONFIG.videosDir,
    UPLOAD_CONFIG.screenshotsDir,
  ];

  dirs.forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`✅ Created upload directory: ${dir}`);
    }
  });
}

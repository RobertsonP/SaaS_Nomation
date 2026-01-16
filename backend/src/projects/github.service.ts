import { Injectable, Logger } from '@nestjs/common';
import simpleGit from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProjectAnalyzerService } from '../analysis/project-analyzer.service';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly tempDir = path.join(process.cwd(), 'temp_repos');

  constructor(
    private projectAnalyzer: ProjectAnalyzerService
  ) {
    // Ensure temp directory exists
    fs.mkdir(this.tempDir, { recursive: true }).catch(err => 
      this.logger.error(`Failed to create temp repo directory: ${err.message}`)
    );
  }

  async importRepository(repoUrl: string, token?: string) {
    const repoId = uuidv4();
    const repoPath = path.join(this.tempDir, repoId);
    
    this.logger.log(`🚀 Starting import of GitHub repository: ${repoUrl}`);

    try {
      // Configure git with optional token
      let remote = repoUrl;
      if (token) {
        // Insert token into URL: https://TOKEN@github.com/user/repo.git
        const urlParts = repoUrl.replace('https://', '').split('/');
        remote = `https://${token}@${urlParts.join('/')}`;
      }

      // Clone repository
      this.logger.log(`📥 Cloning to ${repoPath}...`);
      await simpleGit().clone(remote, repoPath);
      this.logger.log('✅ Clone complete');

      // Read files recursively
      const files = await this.readFilesRecursively(repoPath);
      this.logger.log(`📂 Read ${files.length} files from repository`);

      // Analyze using existing project analyzer
      // Note: We don't create the project here, we return the analysis data
      // The controller/service layer will handle project creation
      
      // Cleanup
      await this.cleanup(repoPath);

      return files;

    } catch (error) {
      this.logger.error(`❌ GitHub import failed: ${error.message}`);
      // Attempt cleanup even on failure
      await this.cleanup(repoPath);
      throw new Error(`Failed to import repository: ${error.message}`);
    }
  }

  private async readFilesRecursively(dir: string, baseDir = dir): Promise<Array<{ name: string; path: string; size: number; type: string; content: string }>> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    // Ignored directories/files
    const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt', 'vendor', 'venv', '__pycache__']);
    const allowedExtensions = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss', 
      '.json', '.xml', '.yml', '.yaml', '.php', '.py', '.rb', '.go', '.java', '.cs'
    ]);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (ignored.has(entry.name)) continue;

      if (entry.isDirectory()) {
        const subFiles = await this.readFilesRecursively(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        
        // Only read supported text files
        if (allowedExtensions.has(ext) || entry.name === 'package.json' || entry.name === 'composer.json' || entry.name === 'requirements.txt') {
          try {
            // Limit file size to 1MB to prevent memory issues
            const stats = await fs.stat(fullPath);
            if (stats.size < 1024 * 1024) {
              const content = await fs.readFile(fullPath, 'utf-8');
              files.push({
                name: entry.name,
                path: relativePath,
                size: stats.size,
                type: 'text/plain', // Simplified type
                content: content
              });
            }
          } catch (e) {
            this.logger.warn(`Failed to read file ${relativePath}: ${e.message}`);
          }
        }
      }
    }

    return files;
  }

  private async cleanup(path: string) {
    try {
      await fs.rm(path, { recursive: true, force: true });
      this.logger.log(`🧹 Cleaned up temp directory: ${path}`);
    } catch (e) {
      this.logger.error(`Failed to cleanup ${path}: ${e.message}`);
    }
  }
}
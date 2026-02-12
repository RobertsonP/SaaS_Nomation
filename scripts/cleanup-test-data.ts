/**
 * Task 1.15: Test Data Cleanup Script
 *
 * Cleans up old test data while preserving example data:
 * - Removes test executions older than retention period
 * - Removes video files older than retention period
 * - Preserves example project and its data
 *
 * Usage:
 *   npx ts-node scripts/cleanup-test-data.ts [--dry-run] [--days=7]
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CleanupOptions {
  dryRun: boolean;
  retentionDays: number;
  exampleProjectName: string;
}

interface CleanupStats {
  executionsDeleted: number;
  stepsDeleted: number;
  videosDeleted: number;
  bytesFreed: number;
}

async function cleanup(options: CleanupOptions): Promise<CleanupStats> {
  const { dryRun, retentionDays, exampleProjectName } = options;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  console.log(`\n🧹 Test Data Cleanup`);
  console.log(`==================`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Retention: ${retentionDays} days`);
  console.log(`Cutoff date: ${cutoffDate.toISOString()}`);
  console.log(`Preserving: ${exampleProjectName}\n`);

  const stats: CleanupStats = {
    executionsDeleted: 0,
    stepsDeleted: 0,
    videosDeleted: 0,
    bytesFreed: 0,
  };

  // Find example project to preserve
  const exampleProject = await prisma.project.findFirst({
    where: { name: exampleProjectName },
  });

  console.log(`📌 Example project: ${exampleProject ? `Found (${exampleProject.id})` : 'Not found'}`);

  // Step 1: Find old test executions (excluding example project)
  const oldExecutions = await prisma.testExecution.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      ...(exampleProject ? { testCase: { projectId: { not: exampleProject.id } } } : {}),
    },
    include: {
      steps: true,
      testCase: { select: { name: true, projectId: true } },
    },
  });

  console.log(`\n📊 Found ${oldExecutions.length} old test executions to clean`);

  for (const execution of oldExecutions) {
    console.log(`  - ${execution.testCase?.name || 'Unknown'} (${execution.createdAt.toISOString()})`);
    stats.stepsDeleted += execution.steps.length;
  }

  // Step 2: Delete old executions and their steps
  if (!dryRun && oldExecutions.length > 0) {
    const executionIds = oldExecutions.map(e => e.id);

    // Delete steps first (foreign key constraint)
    await prisma.testStep.deleteMany({
      where: { executionId: { in: executionIds } },
    });

    // Delete executions
    const result = await prisma.testExecution.deleteMany({
      where: { id: { in: executionIds } },
    });

    stats.executionsDeleted = result.count;
    console.log(`✅ Deleted ${result.count} executions and ${stats.stepsDeleted} steps`);
  } else if (dryRun) {
    stats.executionsDeleted = oldExecutions.length;
    console.log(`⏸️  Would delete ${oldExecutions.length} executions and ${stats.stepsDeleted} steps`);
  }

  // Step 3: Clean up video files
  const uploadsDir = path.join(process.cwd(), 'uploads', 'videos');

  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    console.log(`\n📁 Checking ${files.length} video files...`);

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const fileStat = fs.statSync(filePath);

      if (fileStat.mtime < cutoffDate) {
        stats.bytesFreed += fileStat.size;
        stats.videosDeleted++;

        if (!dryRun) {
          fs.unlinkSync(filePath);
          console.log(`  🗑️  Deleted: ${file} (${formatBytes(fileStat.size)})`);
        } else {
          console.log(`  ⏸️  Would delete: ${file} (${formatBytes(fileStat.size)})`);
        }
      }
    }
  } else {
    console.log(`\n📁 Videos directory not found: ${uploadsDir}`);
  }

  // Step 4: Clean up screenshot files
  const screenshotsDir = path.join(process.cwd(), 'uploads', 'screenshots');

  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    console.log(`\n📁 Checking ${files.length} screenshot files...`);

    let screenshotsDeleted = 0;
    for (const file of files) {
      const filePath = path.join(screenshotsDir, file);
      const fileStat = fs.statSync(filePath);

      if (fileStat.mtime < cutoffDate) {
        stats.bytesFreed += fileStat.size;
        screenshotsDeleted++;

        if (!dryRun) {
          fs.unlinkSync(filePath);
        }
      }
    }

    if (screenshotsDeleted > 0) {
      console.log(`  ${dryRun ? '⏸️  Would delete' : '✅ Deleted'} ${screenshotsDeleted} screenshots`);
    }
  }

  // Step 5: Clean up expired browser sessions
  const expiredSessions = await prisma.browserSession.findMany({
    where: { expiresAt: { lt: new Date() } },
  });

  if (expiredSessions.length > 0) {
    console.log(`\n🌐 Found ${expiredSessions.length} expired browser sessions`);

    if (!dryRun) {
      await prisma.browserSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      console.log(`✅ Deleted ${expiredSessions.length} expired sessions`);
    } else {
      console.log(`⏸️  Would delete ${expiredSessions.length} expired sessions`);
    }
  }

  return stats;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const daysArg = args.find(a => a.startsWith('--days='));
  const retentionDays = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;

  const options: CleanupOptions = {
    dryRun,
    retentionDays,
    exampleProjectName: 'Multi-Page E-commerce Site', // From seed.ts
  };

  try {
    const stats = await cleanup(options);

    console.log(`\n📈 Summary`);
    console.log(`==========`);
    console.log(`Executions: ${stats.executionsDeleted}`);
    console.log(`Steps: ${stats.stepsDeleted}`);
    console.log(`Videos: ${stats.videosDeleted}`);
    console.log(`Space freed: ${formatBytes(stats.bytesFreed)}`);

    if (dryRun) {
      console.log(`\n💡 Run without --dry-run to apply changes`);
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

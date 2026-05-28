import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  const expectedSecret = process.env.ADMIN_SESSION_TOKEN || 'zica_db_push_secret_2026';
  
  if (secret !== expectedSecret) {
    return NextResponse.json({ 
      error: 'Unauthorized. Please provide the correct ?secret= query parameter.' 
    }, { status: 401 });
  }

  const projectRoot = process.cwd();
  console.log(`[DB-PUSH] Running database migrations/seeding in ${projectRoot}...`);

  return new Promise((resolve) => {
    // Step 1: Run prisma db push to create all tables
    exec('npx prisma db push --accept-data-loss', { cwd: projectRoot }, (error, stdout, stderr) => {
      const dbPushLogs = {
        error: error ? error.message : null,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };

      if (error) {
        console.error('[DB-PUSH] prisma db push failed:', error);
        resolve(NextResponse.json({
          success: false,
          stage: 'db_push_failed',
          dbPushLogs
        }));
        return;
      }

      console.log('[DB-PUSH] prisma db push completed successfully. Seeding super admin...');

      // Step 2: Run seed script to register admin users
      exec('npx tsx scripts/seed-super-admin.ts', { cwd: projectRoot }, (seedError, seedStdout, seedStderr) => {
        const seedLogs = {
          error: seedError ? seedError.message : null,
          stdout: seedStdout.trim(),
          stderr: seedStderr.trim()
        };

        resolve(NextResponse.json({
          success: !seedError,
          stage: seedError ? 'seeding_failed' : 'all_completed',
          dbPushLogs,
          seedLogs
        }));
      });
    });
  });
}

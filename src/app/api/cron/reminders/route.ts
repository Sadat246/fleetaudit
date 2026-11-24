import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { runDailyReminders } from '@/lib/reminders/run';
import { createAdminClient } from '@/lib/supabase/admin';

// Vercel calls this once a day (see vercel.json) with
// "Authorization: Bearer <CRON_SECRET>". Anyone else gets a 401.

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function siteOrigin(request: NextRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const summary = await runDailyReminders(createAdminClient(), siteOrigin(request));
  console.info('[reminders] daily run', summary);
  return NextResponse.json(summary);
}

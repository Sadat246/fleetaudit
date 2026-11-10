'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { seedSampleFleet } from '@/lib/db/fleet';
import { todayIn } from '@/lib/engine';
import { createClient } from '@/lib/supabase/server';

export type SetupState = { error?: string };

const Name = z.string().trim().min(1, 'Enter your company name.').max(200, 'That name is too long.');

export async function createCompany(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const name = Name.safeParse(formData.get('name'));
  if (!name.success) return { error: name.error.issues[0].message };

  const supabase = await createClient();
  const { data: companyId, error } = await supabase.rpc('create_company', { company_name: name.data });
  if (error) return { error: error.message };

  if (formData.get('sample') === 'on') {
    try {
      await seedSampleFleet(supabase, companyId as string, todayIn('America/Chicago'));
    } catch {
      return { error: 'Your company was created, but loading the sample drivers failed. Refresh to see your roster.' };
    }
  }
  redirect('/');
}

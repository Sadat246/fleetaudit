'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getMyCompany } from '@/lib/db/fleet';
import { createClient } from '@/lib/supabase/server';

/** Takes a driver's photo out of the inbox without adding it to their file. */
export async function rejectSubmission(id: string) {
  if (!z.uuid().safeParse(id).success) return;
  const supabase = await createClient();
  const company = await getMyCompany(supabase);
  if (!company) return;

  const { error } = await supabase
    .from('submissions')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', company.id)
    .eq('status', 'pending');
  if (error) throw error;
  revalidatePath('/inbox');
}

'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { findUploadLink } from '@/lib/uploads/links';

/** Called after the photo is uploaded: uses up the link and puts the photo in the office's inbox. */
export async function finishDriverUpload(linkToken: string, path: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { state, link } = await findUploadLink(admin, linkToken);
  if (state !== 'ok' || !link) return { error: 'This link is no longer valid. Ask your office for a new one.' };

  // The photo must be in this link's company and driver folder, and must exist.
  if (!path.startsWith(`${link.companyId}/${link.driverId}/`) || path.includes('..')) return { error: 'That upload is not valid.' };
  const { data: exists } = await admin.storage.from('documents').exists(path);
  if (!exists) return { error: 'The photo did not arrive. Try again.' };

  // Use up the link. The "used_at is null" check stops two uploads racing through.
  const { data: used, error: useError } = await admin
    .from('upload_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id)
    .is('used_at', null)
    .select('id');
  if (useError) throw useError;
  if (!used?.length) return { error: 'This link was already used.' };

  const { error } = await admin.from('submissions').insert({
    company_id: link.companyId,
    driver_id: link.driverId,
    link_id: link.id,
    doc_type: link.docType,
    photo_path: path,
  });
  if (error) throw error;
  return {};
}

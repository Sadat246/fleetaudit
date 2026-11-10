'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string; message?: string; email?: string };

const Credentials = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

function read(formData: FormData) {
  return Credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = read(formData);
  const email = String(formData.get('email') ?? '');
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: error.code === 'email_not_confirmed' ? 'Confirm your email first. Check your inbox for the link.' : 'Wrong email or password.',
      email,
    };
  }
  redirect('/');
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = read(formData);
  const email = String(formData.get('email') ?? '');
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const origin = (await headers()).get('origin') ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message, email };

  // Email confirmation turned off in Supabase: already signed in.
  if (data.session) redirect('/');
  return { message: `Check ${parsed.data.email} for a confirmation link, then come back and sign in.`, email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

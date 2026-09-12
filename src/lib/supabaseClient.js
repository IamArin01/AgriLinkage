/**
 * src/lib/supabaseClient.js
 *
 * Supabase client setup and helper functions for AgriTrade.
 *
 * Environment variables (Vite exposes only VITE_* to the browser):
 *   VITE_PUBLIC_SUPABASE_URL      → your project URL
 *   VITE_PUBLIC_SUPABASE_ANON_KEY → your anon/public key  (NOT the service_role key)
 *
 * If you ever migrate to Next.js the client reads the NEXT_PUBLIC_ aliases too.
 */

import { createClient } from '@supabase/supabase-js';

// ── 1. Environment variables ──────────────────────────────────────────────────
// Vite: import.meta.env.VITE_*  |  Next.js: process.env.NEXT_PUBLIC_*
const supabaseUrl =
  import.meta.env?.VITE_PUBLIC_SUPABASE_URL ??
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL);

const supabaseAnonKey =
  import.meta.env?.VITE_PUBLIC_SUPABASE_ANON_KEY ??
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[supabaseClient] Missing environment variables.\n' +
    'Set VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

// ── 2. Singleton Supabase client ──────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// ── 3. Auth helpers ───────────────────────────────────────────────────────────

/**
 * Sign up a new user with email and password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ data: import('@supabase/supabase-js').AuthResponse['data'], error: Error|null }}
 *
 * @example
 * const { data, error } = await signUp('user@example.com', 'secret123');
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) console.error('[signUp] error:', error.message);
  return { data, error };
}

/**
 * Sign in an existing user with email and password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ data: import('@supabase/supabase-js').AuthResponse['data'], error: Error|null }}
 *
 * @example
 * const { data, error } = await signIn('user@example.com', 'secret123');
 * if (!error) console.log('Logged in as', data.user.email);
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) console.error('[signIn] error:', error.message);
  return { data, error };
}

/**
 * Sign out the currently authenticated user.
 *
 * @returns {{ error: Error|null }}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[signOut] error:', error.message);
  return { error };
}

/**
 * Get the current authenticated session (useful for persisting login state).
 *
 * @returns {{ session: import('@supabase/supabase-js').Session|null, error: Error|null }}
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error('[getSession] error:', error.message);
  return { session: data?.session ?? null, error };
}


// ── 4. Notes helpers ──────────────────────────────────────────────────────────
// The `notes` table has RLS enabled: auth.uid() = user_id.
// All operations below automatically scope to the signed-in user's rows.

/**
 * Fetch all notes for the currently authenticated user.
 *
 * The RLS policy (auth.uid() = user_id) ensures that only the owner's
 * rows are returned — no manual user_id filter is needed.
 *
 * @returns {{ data: Array<{id: string, user_id: string, title: string, created_at: string}>|null, error: Error|null }}
 *
 * @example
 * const { data: notes, error } = await getUserNotes();
 */
export async function getUserNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) console.error('[getUserNotes] error:', error.message);
  return { data, error };
}

/**
 * Create a new note for the currently authenticated user.
 *
 * The `user_id` column is populated automatically by the RLS policy /
 * a DB default of `auth.uid()`, so you only need to pass the title.
 * If your table does NOT have that default, pass `user_id` explicitly
 * (see the comment inside the function body).
 *
 * @param {string} title  - The note title / content.
 * @returns {{ data: Array<{id: string, user_id: string, title: string, created_at: string}>|null, error: Error|null }}
 *
 * @example
 * const { data, error } = await createNote('Buy fertiliser');
 */
export async function createNote(title) {
  // Retrieve the current user so we can set user_id explicitly.
  // This is the safest approach and works even if the column has no DB default.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const error = new Error('[createNote] No authenticated user — please sign in first.');
    console.error(error.message);
    return { data: null, error };
  }

  const { data, error } = await supabase
    .from('notes')
    .insert([{ title, user_id: user.id }])
    .select(); // return the inserted row(s)

  if (error) console.error('[createNote] error:', error.message);
  return { data, error };
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && anonKey);

/* Use safe placeholders when env vars are missing so the app still renders
   (createClient throws on an empty URL). supabaseConfigured gates real usage. */
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "public-anon-key-placeholder",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

/* Optional: accounts with these emails are always treated as Managers (owners).
   Off by default - role is chosen at signup. Set NEXT_PUBLIC_OWNER_EMAILS="a@x.com,b@y.com" to enable. */
export const OWNER_EMAILS = (process.env.NEXT_PUBLIC_OWNER_EMAILS ?? "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

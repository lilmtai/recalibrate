import { createClient } from "@supabase/supabase-js";

// The publishable key is meant to be public. Row level security
// (supabase/schema.sql) is what keeps each person's data private.
const url = import.meta.env.VITE_SUPABASE_URL || "https://lhrxjgzgyxlfzitrjzxp.supabase.co";
const key = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_FgM8vLIF4zcna1jga5sqmg_sB41V9E4";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

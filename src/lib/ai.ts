import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Plain-language messages for what the AI functions can answer with. */
export const AI_ERRORS: Record<string, string> = {
  missing_key: "AI isn't switched on yet: the Claude API key still has to be added in Supabase.",
  bad_key: "The Claude API key in Supabase isn't working. Check it in the Anthropic console and paste it again.",
  signin: "Sign in first (Me → Account & sync), so your data stays private.",
  refused: "Couldn't answer that one. Try saying it a bit differently.",
  bad_output: "Something went wrong. Try again.",
  too_long: "That was a lot! Try a shorter version.",
  busy: "Busy right now. Try again in a minute.",
  empty: "Say or type something first.",
};

/** Call one of the app's Edge Functions; returns its data or a message to show. */
export async function callAi<T = unknown>(fn: "log-day" | "assistant", body: Record<string, unknown>): Promise<{ data: T } | { error: string; code: string }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return { error: AI_ERRORS.signin, code: "signin" };
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (!error) return { data: data as T };
  let code = "";
  if (error instanceof FunctionsHttpError) {
    if (error.context?.status === 404) code = "not_deployed";
    else { try { code = (await error.context.json())?.error || ""; } catch { /* not JSON */ } }
  }
  if (code === "not_deployed") return { error: `The “${fn}” function isn't in Supabase yet (see the setup steps).`, code };
  return { error: AI_ERRORS[code] || "Couldn't reach the server. Check your connection and try again.", code };
}

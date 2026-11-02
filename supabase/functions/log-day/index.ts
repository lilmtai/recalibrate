// Supabase Edge Function "log-day": "Tell me about your day" → a structured proposal of what happened.
// The app shows the proposal; nothing is saved until the user approves it (docs/AI_BEHAVIOUR.md).
// Secret to set: ANTHROPIC_API_KEY. Deploy with "Verify JWT" ON (only signed-in users can call it).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

/* ---------- The Claude call ---------- */
export const MODEL = "claude-opus-5-5";

const nullable = (t: Record<string, unknown>) => ({ anyOf: [t, { type: "null" }] });

/** What Claude must return (structured output, validated by the API). */
export function outputSchema(barriers: string[], instead: string[], categories: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["blocks", "extra", "energy", "sleep", "todos", "summary"],
    properties: {
      blocks: {
        type: "array",
        description: "Planned blocks the person talked about. Only ids from the plan.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "status", "minutes", "reason", "note"],
          properties: {
            id: { type: "string" },
            status: { type: "string", enum: ["done", "partial", "missed", "ifnot"] },
            minutes: nullable({ type: "integer", description: "real minutes spent, only if said or clearly implied" }),
            reason: nullable({ type: "string", enum: barriers, description: "why it didn't (fully) happen" }),
            note: nullable({ type: "string" }),
          },
        },
      },
      extra: {
        type: "array",
        description: "Things they did that are not planned blocks (including what they did instead).",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "start", "end", "category", "instead"],
          properties: {
            title: { type: "string", description: "short, like the person said it: 'Phone', 'Lunch with Sam'" },
            start: nullable({ type: "string", description: "HH:MM, 24h; estimate from context, null if no clue" }),
            end: nullable({ type: "string", description: "HH:MM, 24h; null if unknown" }),
            category: nullable({ type: "string", enum: categories }),
            instead: nullable({ type: "string", enum: instead, description: "set when it replaced a planned block" }),
          },
        },
      },
      energy: nullable({ type: "string", enum: ["low", "steady", "high"] }),
      sleep: nullable({ type: "number", description: "hours slept last night, if said" }),
      todos: { type: "array", items: { type: "string" }, description: "new things to do they mentioned" },
      summary: { type: "string", description: "one short, kind sentence summing up the day; no judgement" },
    },
  };
}

const SYSTEM = `You turn a person's spoken summary of their day into a structured log for their ADHD-friendly planner.
They may ramble, repeat themselves or use filler words; dictation may garble words. Use the plan to work out which planned block they mean.
Rules:
- Only report what they said or clearly implied. Never invent blocks, times or reasons. Leave a planned block out if they didn't mention it.
- "done" = did it fully; "partial" = some of it; "missed" = didn't happen; "ifnot" = did the fallback ("if not") version.
- Times are 24h HH:MM on the given date. Estimate from context ("after lunch", "around 8 in the evening") and the plan; use null when there's no clue.
- Use the given keys for reasons, instead and categories, or null when none fits.
- Write titles and notes in the person's language, short. The summary is warm and neutral, never judging.`;

export interface LogDayInput {
  text: string;
  date: string;
  now: string | null;
  plan: { id: string; title: string; start: string; end: string; status: string; ifNot?: string }[];
  categories: { key: string; label: string }[];
  barriers: { key: string; label: string }[];
  instead: { key: string; label: string }[];
}

export type LogDayResult =
  | { ok: true; result: unknown; model: string }
  | { ok: false; error: string; status: number };

export async function understandDay(client: Anthropic, input: LogDayInput): Promise<LogDayResult> {
  const schema = outputSchema(input.barriers.map((b) => b.key), input.instead.map((i) => i.key), input.categories.map((c) => c.key));
  const context = {
    date: input.date,
    time_now: input.now,
    plan: input.plan,
    categories: input.categories,
    reasons: input.barriers,
    instead: input.instead,
  };
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [{
      role: "user",
      content: `Context (JSON):\n${JSON.stringify(context)}\n\nWhat they said:\n"""\n${input.text}\n"""`,
    }],
  });
  if (response.stop_reason === "refusal") return { ok: false, error: "refused", status: 422 };
  if (response.stop_reason === "max_tokens") return { ok: false, error: "too_long", status: 422 };
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return { ok: true, result: JSON.parse(text), model: response.model };
  } catch {
    return { ok: false, error: "bad_output", status: 502 };
  }
}

/* ---------- The HTTP endpoint ---------- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

// any key works to look up who's calling
function lookupKey(): string | undefined {
  const plain = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (plain) return plain;
  for (const name of ["SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_SECRET_KEYS"]) {
    const many = Deno.env.get(name);
    if (!many) continue;
    try {
      const parsed = JSON.parse(many);
      const first = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
      if (typeof first === "string") return first;
    } catch { /* not JSON */ }
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const list = <T>(v: unknown, max: number, map: (x: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x) => x && typeof x === "object").map((x) => map(x as Record<string, unknown>)) : [];
const pairs = (v: unknown) => list(v, 40, (x) => ({ key: str(x.key, 40), label: str(x.label, 60) })).filter((x) => x.key);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "method" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return reply({ error: "missing_key", missing: ["ANTHROPIC_API_KEY"] }, 500);

  // only signed-in users (keeps the API key from being used by anyone else)
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const key = lookupKey();
  if (!jwt || !key) return reply({ error: "signin" }, 401);
  const { data: who } = await createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false } }).auth.getUser(jwt);
  if (!who?.user) return reply({ error: "signin" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "bad_request" }, 400); }
  const input: LogDayInput = {
    text: str(body.text, 6000).trim(),
    date: str(body.date, 10),
    now: typeof body.now === "string" ? str(body.now, 5) : null,
    plan: list(body.plan, 80, (x) => ({
      id: str(x.id, 80), title: str(x.title, 120), start: str(x.start, 5), end: str(x.end, 5), status: str(x.status, 12),
      ...(x.ifNot ? { ifNot: str(x.ifNot, 120) } : {}),
    })),
    categories: pairs(body.categories),
    barriers: pairs(body.barriers),
    instead: pairs(body.instead),
  };
  if (!input.text) return reply({ error: "empty" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !input.categories.length || !input.barriers.length || !input.instead.length) {
    return reply({ error: "bad_request" }, 400);
  }

  try {
    const out = await understandDay(new Anthropic({ apiKey }), input);
    return out.ok ? reply({ result: out.result, model: out.model }) : reply({ error: out.error }, out.status);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return reply({ error: "bad_key" }, 500);
    if (e instanceof Anthropic.RateLimitError) return reply({ error: "busy" }, 429);
    if (e instanceof Anthropic.APIError) return reply({ error: "api", status: e.status }, 502);
    return reply({ error: "network" }, 502);
  }
});

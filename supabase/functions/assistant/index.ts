// Supabase Edge Function "assistant": the in-app planning assistant (chat).
// The app sends the conversation and a compact picture of the person's schedule (with free slots it computed
// itself), work and history. Claude answers and may suggest blocks to add or move; the app checks every
// suggestion and nothing changes until the person taps it (docs/AI_BEHAVIOUR.md).
// Secret: ANTHROPIC_API_KEY (same as log-day). Deploy with "Verify JWT" ON (only signed-in users).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

/* ---------- The Claude call ---------- */
export const MODEL = "claude-opus-5-5";

const SYSTEM = `You are the planning assistant inside Recalibrate, a calm planner for a busy person with ADHD.
You know their next 7 days, free time, routines, to-dos, projects (next steps, goals, notes) and what they really did lately, from the JSON the app gives you. Be warm, brief and practical. Never judge.

Scheduling:
- "freeSlots" were computed by the app and are the only places a new block can go without moving anything. A new block must fit fully inside one free slot. Never schedule in the past (before now.time today).
- Choose well, not just the first gap: match energy (hard / focus work when "doneByPartOfDay" is strongest and on higher-energy days), leave ~10–15 min between blocks when possible, keep meals and evenings sensible, respect deadlines and priorities.
- When asked "when", give 1–3 options and say why in a few words. Suggestions go in "suggestions" (type "add") so the person can add one with a tap.
- If something doesn't fit, you may suggest moving flexible blocks (type "move", with their block_id and new start; keep their length) plus the new block. Never move fixed blocks or blocks whose status isn't "open". At most 4 suggestions.
- Never say you changed, added or moved anything: you only suggest; the person approves.

Work and goals:
- Use projects, next steps, open steps, goals, notes and the journal. Be concrete: name the actual step.
- For "I have N minutes" or "make me a 1h plan": give a short time-boxed plan whose minutes add up to N, first step small and easy to start. Pick the goal or project that matters most now (deadlines, momentum, what was neglected) and say why in one line.

Style: reply in the person's language, plain text, short lines; "- " bullets are fine; no headings, no tables, no emoji. Usually under 120 words. Times as HH:MM. If the data doesn't say, say so briefly instead of guessing.`;

const nullable = (t: Record<string, unknown>) => ({ anyOf: [t, { type: "null" }] });

export function outputSchema(categories: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["reply", "suggestions"],
    properties: {
      reply: { type: "string", description: "what the person reads" },
      suggestions: {
        type: "array",
        description: "schedule changes the person can approve with a tap; empty when none",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "block_id", "date", "title", "start", "minutes", "category", "why"],
          properties: {
            type: { type: "string", enum: ["add", "move"] },
            block_id: nullable({ type: "string", description: "for move: the block's id from the data" }),
            date: { type: "string", description: "YYYY-MM-DD" },
            title: { type: "string" },
            start: { type: "string", description: "HH:MM, 24h" },
            minutes: { type: "integer" },
            category: nullable({ type: "string", enum: categories }),
            why: { type: "string", description: "a few words" },
          },
        },
      },
    },
  };
}

export interface ChatTurn { role: "user" | "assistant"; text: string }

export type AskResult = { ok: true; result: unknown } | { ok: false; error: string; status: number };

export async function ask(client: Anthropic, turns: ChatTurn[], context: Record<string, unknown>, categories: string[]): Promise<AskResult> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SYSTEM },
      { type: "text", text: `The person's data right now (JSON, computed by the app):\n${JSON.stringify(context)}` },
    ],
    output_config: { effort: "medium", format: { type: "json_schema", schema: outputSchema(categories) } },
    messages: turns.map((t) => ({ role: t.role, content: t.text })),
  });
  if (response.stop_reason === "refusal") return { ok: false, error: "refused", status: 422 };
  if (response.stop_reason === "max_tokens") return { ok: false, error: "too_long", status: 422 };
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return { ok: true, result: JSON.parse(text) };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "method" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return reply({ error: "missing_key", missing: ["ANTHROPIC_API_KEY"] }, 500);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const key = lookupKey();
  if (!jwt || !key) return reply({ error: "signin" }, 401);
  const { data: who } = await createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false } }).auth.getUser(jwt);
  if (!who?.user) return reply({ error: "signin" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "bad_request" }, 400); }
  // the last 12 turns, alternating, starting and ending with the person
  const raw = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const turns: ChatTurn[] = [];
  for (const m of raw) {
    const role = m?.role === "assistant" ? "assistant" : m?.role === "user" ? "user" : null;
    const text = typeof m?.text === "string" ? m.text.trim().slice(0, 4000) : "";
    if (!role || !text) continue;
    if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1].text += `\n${text}`;
    else turns.push({ role, text });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return reply({ error: "empty" }, 400);

  const context = body.context && typeof body.context === "object" ? body.context as Record<string, unknown> : null;
  if (!context || JSON.stringify(context).length > 80_000) return reply({ error: "bad_request" }, 400);
  const categories = Array.isArray(context.categories)
    ? (context.categories as { key?: unknown }[]).map((c) => (typeof c?.key === "string" ? c.key : "")).filter(Boolean).slice(0, 40)
    : [];
  if (!categories.length) return reply({ error: "bad_request" }, 400);

  try {
    const out = await ask(new Anthropic({ apiKey }), turns, context, categories);
    return out.ok ? reply({ result: out.result }) : reply({ error: out.error }, out.status);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return reply({ error: "bad_key" }, 500);
    if (e instanceof Anthropic.RateLimitError) return reply({ error: "busy" }, 429);
    if (e instanceof Anthropic.APIError) return reply({ error: "api", status: e.status }, 502);
    return reply({ error: "network" }, 502);
  }
});

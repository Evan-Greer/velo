import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Embeds the same evidence-based approach the flashcard generator uses:
// worked-example-first for anything genuinely new, spaced/interleaved
// retrieval practice for everything already introduced, and urgency
// shaped by real deadlines and the priority the student set -- not a
// generic "study more" plan.
const SYSTEM_PROMPT = `
You write a short, concrete study plan for one college class, for a student with ADHD who does best with short focused sessions rather than long ones.

You'll be given: the class's priority level, what was covered in recent lessons, upcoming homework/exam deadlines, and current flashcard review stats for the class.

Ground every recommendation in what's actually due or recently covered -- reference specific lesson topics and specific deadlines by name, don't write generic advice. If a lesson was recently logged and no cards exist for it yet, say so explicitly (e.g. "upload notes from the divergence theorem lesson so it gets turned into cards"). If an exam is close, recommend daily short review blocks rather than one long cram session. If nothing is urgent, say that plainly and recommend steady light review instead of manufacturing urgency.

Return 3 to 6 recommendations, ordered most important first. Each should be doable as a single short (15-20 minute) focused session.
`.trim();

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          headline: { type: "string" },
          detail: { type: "string" },
        },
        required: ["headline", "detail"],
        additionalProperties: false,
      },
    },
  },
  required: ["plan"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { className, priority, lessons, upcoming, cardStats } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY inside Edge Function Secrets.");
    }

    const client = new Anthropic({ apiKey });

    const lessonsText = (lessons || []).length
      ? (lessons as { entry_date: string; content: string }[]).map(l => `- ${l.entry_date}: ${l.content}`).join('\n')
      : '(no lessons logged yet)';

    const upcomingText = (upcoming || []).length
      ? (upcoming as { title: string; type: string; due_date: string }[]).map(u => `- ${u.due_date}: ${u.title} (${u.type})`).join('\n')
      : '(nothing on the calendar for this class)';

    const statsText = cardStats
      ? `${cardStats.due} of ${cardStats.total} cards due today (${cardStats.procedural} procedural, ${cardStats.declarative} declarative)`
      : 'no flashcards generated yet';

    const userMessage = `
Class: ${className}
Priority: ${priority}

Recent lessons:
${lessonsText}

Upcoming deadlines:
${upcomingText}

Flashcard status: ${statsText}
`.trim();

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    const parsed = textBlock ? JSON.parse((textBlock as any).text) : { plan: [] };

    return new Response(JSON.stringify({ plan: parsed.plan || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const isRateLimit = error?.status === 429;
    return new Response(JSON.stringify({
      error: isRateLimit
        ? "Claude's rate limit was hit -- try again in a bit."
        : `Plan generation failed: ${error.message}`,
      errorType: isRateLimit ? 'rate_limit' : 'api_error',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

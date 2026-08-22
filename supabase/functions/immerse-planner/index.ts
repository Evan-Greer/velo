import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Grounded in the learning-science literature, not intuition:
// - Dunlosky et al. 2013 (Psych Science in the Public Interest) rates
//   practice testing and distributed/spaced practice as the two
//   HIGH-utility techniques out of 10 studied; interleaving and
//   elaborative interrogation are moderate; rereading/highlighting are
//   low utility. This planner only ever prescribes retrieval-based,
//   spaced, interleaved actions -- never "reread your notes."
// - The spacing/lag effect: gaps should scale with how far out the
//   thing you're preparing for is, roughly 10-30% of the retention
//   interval, with real checkpoints (not daily grinding, not one
//   cram session). Concretely: exams ~1-2 weeks out get checkpoints
//   spaced ~2-3 days apart; exams ~3+ weeks out get fewer, wider
//   checkpoints early that tighten to ~1-2 days apart in the final
//   week. The last checkpoint is always light review, never new
//   material, and never later than the day before.
// - Desirable difficulties (Bjork): short sessions with real retrieval
//   effort beat long smooth review sessions, which is also why this
//   stays short-block (15-20 min) rather than marathon study blocks.
const SYSTEM_PROMPT = `
You write a short, concrete study plan for one college class, for a student with ADHD who does best with short focused sessions rather than long ones.

You'll be given: today's date, the class's priority level, what was covered in recent lessons, upcoming homework/exam deadlines, current flashcard review stats, and any topics the student recently missed on a self-quiz.

Every recommendation must be a retrieval-practice or spaced-review action -- self-testing, flashcard review, practice problems, a self-quiz. Never recommend rereading notes, highlighting, or re-watching a lecture as a primary action; those are low-utility per the research base this planner is built on. Ground every recommendation in what's actually due or recently covered -- reference specific lesson topics and specific deadlines by name, don't write generic advice. If a lesson was recently logged and no cards exist for it yet, say so explicitly. If the student recently missed quiz topics, prioritize a recommendation that retests exactly those topics. If nothing is urgent, say that plainly and recommend steady light review instead of manufacturing urgency.

Return 3 to 6 recommendations for "plan", ordered most important first. Each should be doable as a single short (15-20 minute) focused session -- short blocks with real retrieval effort beat long passive review sessions.

Separately, check if there's a test/exam more than 3 days away. If so, also build "examCountdown": a countdown of short study checkpoints between today and that exam, using real calendar dates (YYYY-MM-DD), each with a concrete task naming the exam and topic, and a duration in minutes (15-25 min each). Follow the spacing/lag effect: checkpoints should NOT be daily and should NOT be just one or two sessions either -- scale checkpoint spacing to how far out the exam is (wider gaps early when the exam is far out, tightening to every 1-2 days in the final week). The very last checkpoint must be a light review the day before the exam, never new material, and no checkpoint should land on the exam day itself. If there's no test/exam more than 3 days out, return an empty array for examCountdown.
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
    examCountdown: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          task: { type: "string" },
          minutes: { type: "number" },
        },
        required: ["date", "task", "minutes"],
        additionalProperties: false,
      },
    },
  },
  required: ["plan", "examCountdown"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { className, priority, lessons, upcoming, cardStats, recentQuizMisses } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY inside Edge Function Secrets.");
    }

    const client = new Anthropic({ apiKey });

    const today = new Date().toISOString().slice(0, 10);

    const lessonsText = (lessons || []).length
      ? (lessons as { entry_date: string; content: string }[]).map(l => `- ${l.entry_date}: ${l.content}`).join('\n')
      : '(no lessons logged yet)';

    const upcomingText = (upcoming || []).length
      ? (upcoming as { title: string; type: string; due_date: string }[]).map(u => `- ${u.due_date}: ${u.title} (${u.type})`).join('\n')
      : '(nothing on the calendar for this class)';

    const statsText = cardStats
      ? `${cardStats.due} of ${cardStats.total} cards due today (${cardStats.procedural} procedural, ${cardStats.declarative} declarative)`
      : 'no flashcards generated yet';

    const missesText = (recentQuizMisses || []).length
      ? (recentQuizMisses as { topic: string }[]).map(m => `- ${m.topic}`).join('\n')
      : '(no recent quiz misses)';

    const userMessage = `
Today's date: ${today}
Class: ${className}
Priority: ${priority}

Recent lessons:
${lessonsText}

Upcoming deadlines:
${upcomingText}

Flashcard status: ${statsText}

Recently missed quiz topics:
${missesText}
`.trim();

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    const parsed = textBlock ? JSON.parse((textBlock as any).text) : { plan: [], examCountdown: [] };

    return new Response(JSON.stringify({ plan: parsed.plan || [], examCountdown: parsed.examCountdown || [] }), {
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

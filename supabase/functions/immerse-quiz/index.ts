import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Multiple-choice self-quizzing rather than flashcards: retrieval practice
// with a second technique layered on -- elaborative interrogation, where
// the explanation has to say *why* the right answer is right, not just
// confirm it (a moderate-utility technique on its own, and it's what
// turns a miss into something worth reviewing rather than just a wrong
// answer). Questions are drawn from cards spanning multiple lessons/
// materials so the quiz interleaves topics rather than blocking one at a
// time -- interleaving beats blocking for long-term retention and
// transfer, even though it feels harder in the moment.
const SYSTEM_PROMPT = `
You write a short 5-question multiple-choice quiz for a college class, built from flashcards already generated for it and recent lesson notes.

Each question needs 4 plausible options with exactly one correct answer -- wrong options should be genuinely plausible (common mistakes or adjacent concepts), not obviously wrong filler. Prefer questions that require applying or connecting a concept over ones that just ask for verbatim recall of a flashcard's back side. Write a 1-2 sentence explanation for the correct answer that explains *why* it's correct (the reasoning, not just a restatement) -- this is what the student reads if they get it wrong. Give each question a short 2-4 word "topic" label naming what it's testing, specific enough to search for outside help on (e.g. "L'Hopital's rule" not "Calculus").

Draw questions from across the different topics/lessons present in the material provided rather than clustering multiple questions on the same narrow topic -- mix it up.

Return exactly 5 questions.
`.trim();

const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correctIndex: { type: "number" },
          explanation: { type: "string" },
          topic: { type: "string" },
        },
        required: ["question", "options", "correctIndex", "explanation", "topic"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { className, cards, lessons } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY inside Edge Function Secrets.");
    }
    if (!cards || !cards.length) {
      throw new Error("No flashcards yet to build a quiz from -- generate cards from a material first.");
    }

    const client = new Anthropic({ apiKey });

    const cardsText = (cards as { front: string; back: string }[])
      .map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`)
      .join('\n');

    const lessonsText = (lessons || []).length
      ? (lessons as { entry_date: string; content: string }[]).map(l => `- ${l.entry_date}: ${l.content}`).join('\n')
      : '(no lessons logged)';

    const userMessage = `
Class: ${className}

Existing flashcards for this class:
${cardsText}

Recent lessons:
${lessonsText}

Write a 5-question quiz covering a mix of this material.
`.trim();

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: QUIZ_SCHEMA } },
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    const parsed = textBlock ? JSON.parse((textBlock as any).text) : { questions: [] };

    return new Response(JSON.stringify({ questions: parsed.questions || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const isRateLimit = error?.status === 429;
    return new Response(JSON.stringify({
      error: isRateLimit
        ? "Claude's rate limit was hit -- try again in a bit."
        : `Quiz generation failed: ${error.message}`,
      errorType: isRateLimit ? 'rate_limit' : 'api_error',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

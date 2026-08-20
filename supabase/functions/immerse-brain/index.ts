import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Card type distinguishes STEM problem-solving material (front poses a
// problem, back is the worked method -- Calc III / Physics / Statics) from
// plain recall material (front asks for a fact/definition/property --
// Materials science, conceptual content). The two need different card
// shapes to actually be useful for spaced repetition.
const SYSTEM_PROMPT = `
You generate spaced-repetition flashcards from a single piece of uploaded college class material.

Classify each card as either:
- "procedural": the front poses a problem or task to work through (e.g. a math/physics/statics problem, a step in a method), and the back is the worked solution or method. Use this for STEM problem-solving material.
- "declarative": the front asks for a fact, definition, property, or concept, and the back is the direct answer. Use this for conceptual/recall material.

Generate as many high-quality, independently testable cards as the material genuinely supports -- typically 5 to 15 for a single document, fewer for short/sparse material. Prioritize quality and real test-ability over quantity. Do not create near-duplicate cards or cards that just restate the material's structure (e.g. "what is section 2 about"). Keep both front and back concise -- a card should take seconds to read, not paragraphs.
`.trim();

const CARD_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["procedural", "declarative"] },
          front: { type: "string" },
          back: { type: "string" },
        },
        required: ["type", "front", "back"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileBase64, mimeType, className, materialTitle } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY inside Edge Function Secrets.");
    }
    if (!fileBase64 || !mimeType) {
      throw new Error("Missing file content.");
    }

    const client = new Anthropic({ apiKey });

    // PDFs go in as a document block, everything else (images) as an image
    // block -- both accept the same base64 shape.
    const contentBlock = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } };

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: CARD_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          contentBlock as any,
          { type: 'text', text: `Class: ${className || 'Unknown'}. Material: ${materialTitle || 'Untitled'}. Generate flashcards from this material.` },
        ],
      }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    const parsed = textBlock ? JSON.parse((textBlock as any).text) : { cards: [] };

    return new Response(JSON.stringify({ cards: parsed.cards || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const isRateLimit = error?.status === 429;
    return new Response(JSON.stringify({
      error: isRateLimit
        ? "Claude's rate limit was hit -- try again in a bit."
        : `Card generation failed: ${error.message}`,
      errorType: isRateLimit ? 'rate_limit' : 'api_error',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

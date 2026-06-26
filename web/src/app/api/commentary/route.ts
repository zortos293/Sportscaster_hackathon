import OpenAI from "openai";
import {
  buildCommentaryUserPrompt,
  COMMENTARY_SYSTEM_PROMPT,
  templateCommentary,
} from "@/lib/commentary-prompts";
import type { GameBroadcastContext } from "@/lib/game-context";
import type { TimelineEvent } from "@/lib/timeline";

type CommentaryRequest = {
  event: TimelineEvent;
  gameTitle: string;
  persona: string;
  gameContext?: GameBroadcastContext;
  recentLines?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommentaryRequest;
  const { event, gameTitle, persona, gameContext, recentLines = [] } = body;

  if (!event || !gameTitle) {
    return Response.json({ error: "event and gameTitle are required" }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();
  const userPrompt = buildCommentaryUserPrompt({
    persona,
    gameTitle,
    event,
    gameContext,
    recentLines,
  });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const fallback = templateCommentary(event, gameTitle, gameContext);
  const apiKey = process.env.OPENAI_API_KEY;

  const debug = {
    generatedAt,
    event,
    persona,
    gameContext,
    recentLines,
    userPrompt,
    systemPrompt: COMMENTARY_SYSTEM_PROMPT,
    model,
  };

  if (!apiKey || apiKey === "your_openai_key_here") {
    return Response.json({ text: fallback, source: "template", debug });
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      temperature: 0.95,
      max_tokens: 130,
      messages: [
        { role: "system", content: COMMENTARY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    return Response.json({
      text: text || fallback,
      source: text ? "llm" : "template",
      debug: {
        ...debug,
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
      },
    });
  } catch (error) {
    return Response.json({
      text: fallback,
      source: "template",
      debug: {
        ...debug,
        error: error instanceof Error ? error.message : "Commentary generation failed",
      },
    });
  }
}

import {
  fetchEspnGameSummary,
  diffGameState,
  type LiveGameState,
  type GameDiff,
} from "@/lib/espn-live";
import {
  buildCommentaryUserPrompt,
  COMMENTARY_SYSTEM_PROMPT,
} from "@/lib/commentary-prompts";
import {
  cursorCommentaryConfigured,
  generateCursorCommentary,
  bootstrapStreamAgent,
} from "@/lib/cursor-commentary";
import type { GameBroadcastContext } from "@/lib/game-context";
import type { TimelineEvent } from "@/lib/timeline";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type LiveStreamParams = {
  params: Promise<{ gameId: string }>;
};

type LiveConfig = {
  sport: string;
  league: string;
  eventId: string;
  persona: string;
  pollIntervalMs: number;
};

function parseGameId(gameId: string): LiveConfig {
  const parts = gameId.split("-");
  if (parts.length < 3) {
    throw new Error("Invalid gameId format. Expected: sport-league-eventId[-persona]");
  }

  const [sport, league, eventId, persona = "energetic broadcaster"] = parts;
  const pollIntervalMs = Number.parseInt(process.env.LIVE_POLL_INTERVAL_MS ?? "15000", 10);

  return {
    sport,
    league,
    eventId,
    persona: decodeURIComponent(persona),
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 15000,
  };
}

function gameStateToContext(state: LiveGameState): GameBroadcastContext {
  return {
    matchup: `${state.awayTeam} at ${state.homeTeam}`,
    awayTeam: state.awayTeam,
    homeTeam: state.homeTeam,
    venue: state.venue,
    facts: [
      `Score: ${state.awayScore}-${state.homeScore}`,
      state.leaders,
      state.teamStats,
      `Status: ${state.status}`,
      state.clock ? `Clock: ${state.clock}` : undefined,
    ].filter(Boolean) as string[],
    narrative: `${state.awayTeam} ${state.awayScore} - ${state.homeScore} ${state.homeTeam}. ${state.status}`,
  };
}

function diffToTimelineEvent(
  diff: GameDiff,
  state: LiveGameState,
  index: number,
): TimelineEvent {
  let kind: TimelineEvent["kind"];
  if (diff.type === "score") {
    kind = "score";
  } else if (diff.type === "period") {
    kind = "period";
  } else if (diff.type === "status") {
    kind = "opening";
  } else {
    kind = "key_play";
  }

  return {
    id: `live-${Date.now()}-${index}`,
    kind,
    videoAt: 0,
    gameElapsed: 0,
    periodLabel: state.period || "Live",
    description: diff.description,
    context: diff.play?.text,
    scoreHome: state.homeScore,
    scoreAway: state.awayScore,
  };
}

async function generateCommentaryForDiff(
  diff: GameDiff,
  state: LiveGameState,
  config: LiveConfig,
  recentLines: string[],
  cursorAgentId?: string,
): Promise<{ text: string; cursorAgentId?: string } | null> {
  const event = diffToTimelineEvent(diff, state, 0);
  const gameContext = gameStateToContext(state);
  const gameTitle = `${state.awayTeam} at ${state.homeTeam}`;

  const userPrompt = buildCommentaryUserPrompt({
    persona: config.persona,
    gameTitle,
    event,
    gameContext,
    recentLines,
  });

  if (cursorCommentaryConfigured() && cursorAgentId) {
    try {
      const result = await generateCursorCommentary({
        apiKey: process.env.CURSOR_API_KEY!,
        systemPrompt: COMMENTARY_SYSTEM_PROMPT,
        userPrompt,
        agentId: cursorAgentId,
        timeoutMs: 30_000,
      });
      return { text: result.text, cursorAgentId: result.agentId };
    } catch (error) {
      console.warn("[live] Cursor commentary failed:", error);
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && openAiKey !== "your_openai_key_here") {
    try {
      const client = new OpenAI({ apiKey: openAiKey });
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.95,
        max_tokens: 130,
        messages: [
          { role: "system", content: COMMENTARY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      const text = response.choices[0]?.message?.content?.trim();
      if (text) return { text };
    } catch (error) {
      console.warn("[live] OpenAI commentary failed:", error);
    }
  }

  return { text: diff.description };
}

export async function GET(request: Request, { params }: LiveStreamParams) {
  const { gameId } = await params;

  let config: LiveConfig;
  try {
    config = parseGameId(gameId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid gameId" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  let previousState: LiveGameState | null = null;
  let cursorAgentId: string | undefined;
  const recentLines: string[] = [];
  let isActive = true;

  const sendEvent = (
    controller: ReadableStreamDefaultController,
    event: string,
    data: unknown,
  ) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    } catch {
      isActive = false;
    }
  };

  const readable = new ReadableStream({
    async start(controller) {
      sendEvent(controller, "connected", {
        gameId,
        config: {
          sport: config.sport,
          league: config.league,
          eventId: config.eventId,
          pollIntervalMs: config.pollIntervalMs,
        },
      });

      if (cursorCommentaryConfigured()) {
        try {
          const gameTitle = `Live: ${config.sport}/${config.league}/${config.eventId}`;
          const result = await bootstrapStreamAgent({
            apiKey: process.env.CURSOR_API_KEY!,
            gameId: `live-${gameId}`,
            bootstrapPrompt: `You are a live sports commentator for ${gameTitle}. Respond with READY to confirm.`,
            timeoutMs: 30_000,
          });
          cursorAgentId = result.agentId;
          sendEvent(controller, "agent_ready", { cursorAgentId });
        } catch (error) {
          console.warn("[live] Failed to bootstrap Cursor agent:", error);
        }
      }

      const poll = async () => {
        if (!isActive) return;

        try {
          const state = await fetchEspnGameSummary(
            config.sport,
            config.league,
            config.eventId,
          );

          sendEvent(controller, "state", {
            homeTeam: state.homeTeam,
            awayTeam: state.awayTeam,
            homeScore: state.homeScore,
            awayScore: state.awayScore,
            status: state.status,
            period: state.period,
            clock: state.clock,
          });

          const diffs = diffGameState(previousState, state);

          for (const diff of diffs) {
            const result = await generateCommentaryForDiff(
              diff,
              state,
              config,
              recentLines.slice(-4),
              cursorAgentId,
            );

            if (result) {
              recentLines.push(result.text);
              if (recentLines.length > 10) recentLines.shift();

              if (result.cursorAgentId) {
                cursorAgentId = result.cursorAgentId;
              }

              sendEvent(controller, "commentary", {
                type: diff.type,
                text: result.text,
                score: { home: state.homeScore, away: state.awayScore },
                period: state.period,
                timestamp: new Date().toISOString(),
              });
            }
          }

          previousState = state;

          if (
            state.status.toLowerCase().includes("final") ||
            state.status.toLowerCase().includes("end")
          ) {
            sendEvent(controller, "ended", { finalScore: `${state.awayScore}-${state.homeScore}` });
            isActive = false;
            controller.close();
            return;
          }
        } catch (error) {
          console.error("[live] Poll error:", error);
          sendEvent(controller, "error", {
            message: error instanceof Error ? error.message : "Poll failed",
          });
        }

        if (isActive) {
          setTimeout(poll, config.pollIntervalMs);
        }
      };

      void poll();

      request.signal.addEventListener("abort", () => {
        isActive = false;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

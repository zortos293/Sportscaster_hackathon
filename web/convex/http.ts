import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/webhook/cache-matches",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.CACHE_WEBHOOK_SECRET?.trim();
    if (expectedSecret) {
      const authHeader = request.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : authHeader.trim();
      if (token !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    let body: {
      gameId?: string;
      title?: string;
      subtitle?: string;
      source?: string;
      lines?: Array<{
        eventKey: string;
        eventId: string;
        kind: string;
        description: string;
        videoAt: number;
        text: string;
        source: string;
      }>;
    };

    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { gameId, title, subtitle, source, lines } = body;
    if (!gameId || !title || !Array.isArray(lines) || lines.length === 0) {
      return new Response(
        JSON.stringify({ error: "gameId, title, and non-empty lines are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await ctx.runMutation(api.matches.upsertMatchCache, {
      gameId,
      title,
      subtitle: subtitle ?? "",
      source: source ?? "webhook",
      lines,
    });

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;

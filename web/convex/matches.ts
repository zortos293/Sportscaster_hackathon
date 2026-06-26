import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const commentaryLineValidator = v.object({
  eventKey: v.string(),
  eventId: v.string(),
  kind: v.string(),
  description: v.string(),
  videoAt: v.number(),
  text: v.string(),
  source: v.string(),
});

const alignedEventValidator = v.object({
  eventKey: v.string(),
  eventId: v.string(),
  kind: v.string(),
  description: v.string(),
  gameElapsed: v.number(),
  videoAt: v.number(),
  scoreHome: v.number(),
  scoreAway: v.number(),
  periodLabel: v.string(),
  context: v.optional(v.string()),
  confidence: v.number(),
});

const ocrAnchorValidator = v.object({
  period: v.string(),
  gameElapsed: v.number(),
  videoAt: v.number(),
  rawText: v.string(),
  confidence: v.number(),
});

export const listMatchCaches = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("matchCaches").collect();
  },
});

export const getCommentaryLinesForGame = query({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    return ctx.db
      .query("matchCommentaryLines")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
  },
});

export const getCommentaryLine = query({
  args: { gameId: v.string(), eventKey: v.string() },
  handler: async (ctx, { gameId, eventKey }) => {
    return ctx.db
      .query("matchCommentaryLines")
      .withIndex("by_gameId_eventKey", (q) =>
        q.eq("gameId", gameId).eq("eventKey", eventKey),
      )
      .unique();
  },
});

export const upsertCommentaryLine = mutation({
  args: {
    gameId: v.string(),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    source: v.optional(v.string()),
    line: commentaryLineValidator,
  },
  handler: async (ctx, args) => {
    const cachedAt = Date.now();
    const existing = await ctx.db
      .query("matchCommentaryLines")
      .withIndex("by_gameId_eventKey", (q) =>
        q.eq("gameId", args.gameId).eq("eventKey", args.line.eventKey),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args.line, cachedAt });
    } else {
      await ctx.db.insert("matchCommentaryLines", {
        gameId: args.gameId,
        ...args.line,
        cachedAt,
      });
    }

    const allLines = await ctx.db
      .query("matchCommentaryLines")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();

    const cacheMeta = await ctx.db
      .query("matchCaches")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .unique();

    const cacheDoc = {
      gameId: args.gameId,
      title: args.title ?? cacheMeta?.title ?? args.gameId,
      subtitle: args.subtitle ?? cacheMeta?.subtitle ?? "",
      lineCount: allLines.length,
      cachedAt,
      source: args.source ?? cacheMeta?.source ?? args.line.source,
    };

    if (cacheMeta) {
      await ctx.db.patch(cacheMeta._id, cacheDoc);
    } else if (args.title) {
      await ctx.db.insert("matchCaches", cacheDoc);
    }

    return { gameId: args.gameId, eventKey: args.line.eventKey, cachedAt };
  },
});

export const upsertMatchCache = mutation({
  args: {
    gameId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    source: v.string(),
    lines: v.array(commentaryLineValidator),
  },
  handler: async (ctx, args) => {
    const cachedAt = Date.now();

    const existingLines = await ctx.db
      .query("matchCommentaryLines")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const line of existingLines) {
      await ctx.db.delete(line._id);
    }

    for (const line of args.lines) {
      await ctx.db.insert("matchCommentaryLines", {
        gameId: args.gameId,
        ...line,
        cachedAt,
      });
    }

    const existingCache = await ctx.db
      .query("matchCaches")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .unique();

    const cacheDoc = {
      gameId: args.gameId,
      title: args.title,
      subtitle: args.subtitle,
      lineCount: args.lines.length,
      cachedAt,
      source: args.source,
    };

    if (existingCache) {
      await ctx.db.patch(existingCache._id, cacheDoc);
      return { gameId: args.gameId, lineCount: args.lines.length, cachedAt };
    }

    await ctx.db.insert("matchCaches", cacheDoc);
    return { gameId: args.gameId, lineCount: args.lines.length, cachedAt };
  },
});

export const clearMatchCache = mutation({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    const lines = await ctx.db
      .query("matchCommentaryLines")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
    for (const line of lines) {
      await ctx.db.delete(line._id);
    }

    const cache = await ctx.db
      .query("matchCaches")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (cache) {
      await ctx.db.delete(cache._id);
    }

    return { gameId, cleared: true };
  },
});

export const listFullMatchImports = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("fullMatchImports").collect();
  },
});

export const getFullMatchImport = query({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    return ctx.db
      .query("fullMatchImports")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
  },
});

export const upsertFullMatchImport = mutation({
  args: {
    gameId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    sourceUrl: v.string(),
    liveScoreMatchId: v.string(),
    fotmobMatchId: v.optional(v.string()),
    flashscoreMatchId: v.optional(v.string()),
    sofaScoreEventId: v.optional(v.string()),
    status: v.string(),
    statusMessage: v.optional(v.string()),
    videoFile: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("fullMatchImports")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .unique();

    const doc = {
      ...args,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return { gameId: args.gameId, updatedAt: now };
    }

    await ctx.db.insert("fullMatchImports", {
      ...doc,
      createdAt: now,
    });
    return { gameId: args.gameId, updatedAt: now };
  },
});

export const replaceFullMatchAnchors = mutation({
  args: {
    gameId: v.string(),
    anchors: v.array(ocrAnchorValidator),
  },
  handler: async (ctx, { gameId, anchors }) => {
    const existing = await ctx.db
      .query("fullMatchOcrAnchors")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
    for (const anchor of existing) {
      await ctx.db.delete(anchor._id);
    }

    const createdAt = Date.now();
    for (const anchor of anchors) {
      await ctx.db.insert("fullMatchOcrAnchors", {
        gameId,
        ...anchor,
        createdAt,
      });
    }

    return { gameId, anchorCount: anchors.length };
  },
});

export const getFullMatchAnchors = query({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    return ctx.db
      .query("fullMatchOcrAnchors")
      .withIndex("by_gameId_gameElapsed", (q) => q.eq("gameId", gameId))
      .collect();
  },
});

export const replaceFullMatchAlignedEvents = mutation({
  args: {
    gameId: v.string(),
    events: v.array(alignedEventValidator),
  },
  handler: async (ctx, { gameId, events }) => {
    const existing = await ctx.db
      .query("fullMatchAlignedEvents")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
    for (const event of existing) {
      await ctx.db.delete(event._id);
    }

    const createdAt = Date.now();
    for (const event of events) {
      await ctx.db.insert("fullMatchAlignedEvents", {
        gameId,
        ...event,
        createdAt,
      });
    }

    return { gameId, eventCount: events.length };
  },
});

export const getFullMatchAlignedEvents = query({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    return ctx.db
      .query("fullMatchAlignedEvents")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
  },
});

export const listHighlights = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("fullMatchAlignedEvents").collect();
    const imports = await ctx.db.query("fullMatchImports").collect();
    const importMap = new Map(imports.map((imp) => [imp.gameId, imp]));

    return events
      .filter((e) => e.kind === "score" || e.kind === "key_play")
      .map((e) => ({
        _id: e._id,
        gameId: e.gameId,
        kind: e.kind,
        description: e.description,
        gameElapsed: e.gameElapsed,
        videoAt: e.videoAt,
        scoreHome: e.scoreHome,
        scoreAway: e.scoreAway,
        periodLabel: e.periodLabel,
        context: e.context,
        confidence: e.confidence,
        matchTitle: importMap.get(e.gameId)?.title ?? "Unknown Match",
        matchSubtitle: importMap.get(e.gameId)?.subtitle ?? "",
      }));
  },
});

export const clearFullMatchImport = mutation({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    const anchors = await ctx.db
      .query("fullMatchOcrAnchors")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
    for (const anchor of anchors) {
      await ctx.db.delete(anchor._id);
    }

    const events = await ctx.db
      .query("fullMatchAlignedEvents")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    const lines = await ctx.db
      .query("matchCommentaryLines")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();
    for (const line of lines) {
      await ctx.db.delete(line._id);
    }

    const cache = await ctx.db
      .query("matchCaches")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (cache) {
      await ctx.db.delete(cache._id);
    }

    const importJob = await ctx.db
      .query("fullMatchImports")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (importJob) {
      await ctx.db.delete(importJob._id);
    }

    return {
      gameId,
      deleted: {
        anchors: anchors.length,
        events: events.length,
        lines: lines.length,
        cache: Boolean(cache),
        import: Boolean(importJob),
      },
    };
  },
});

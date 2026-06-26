import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,

  matchCaches: defineTable({
    gameId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    lineCount: v.number(),
    cachedAt: v.number(),
    source: v.string(),
  }).index("by_gameId", ["gameId"]),

  matchCommentaryLines: defineTable({
    gameId: v.string(),
    eventKey: v.string(),
    eventId: v.string(),
    kind: v.string(),
    description: v.string(),
    videoAt: v.number(),
    text: v.string(),
    source: v.string(),
    cachedAt: v.number(),
  })
    .index("by_gameId", ["gameId"])
    .index("by_gameId_eventKey", ["gameId", "eventKey"]),

  fullMatchImports: defineTable({
    gameId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    sourceUrl: v.string(),
    videoFile: v.optional(v.string()),
    liveScoreMatchId: v.string(),
    status: v.string(),
    statusMessage: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_gameId", ["gameId"])
    .index("by_liveScoreMatchId", ["liveScoreMatchId"]),

  fullMatchOcrAnchors: defineTable({
    gameId: v.string(),
    period: v.string(),
    gameElapsed: v.number(),
    videoAt: v.number(),
    rawText: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
  })
    .index("by_gameId", ["gameId"])
    .index("by_gameId_gameElapsed", ["gameId", "gameElapsed"]),

  fullMatchAlignedEvents: defineTable({
    gameId: v.string(),
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
    createdAt: v.number(),
  })
    .index("by_gameId", ["gameId"])
    .index("by_gameId_eventKey", ["gameId", "eventKey"]),
});

export default schema;

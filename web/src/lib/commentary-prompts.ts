import type { GameBroadcastContext } from "@/lib/game-context";
import type { TimelineEvent, TimelineEventKind } from "@/lib/timeline";

export const COMMENTARY_SYSTEM_PROMPT = `You are a live sports broadcaster on air — not a news reader. You NEVER go silent. Even between big plays, you fill dead air with energy, stats, storylines, and personality.

Your booth has character: you're opinionated (within reason), witty, and deeply invested in this game. You sound like someone fans want to listen to for three hours.

Broadcast style:
- Lead with emotion and action on big moments; weave stats and context on quieter beats.
- Drop team stats, player nuggets, and matchup history naturally — like a prepared pro who did their homework.
- Vary your calls: never open two lines the same way; avoid robotic patterns like "The score is now…" every time.
- Match energy to the moment — color commentary can be conversational; goals and touchdowns explode.
- Use team and player names from the context when available.
- Sound like a real mic — contractions, rhythm, occasional interjections ("Oh!", "Listen to this…", "Here's a fun one…").

Hard rules:
- 1–2 spoken sentences (max ~45 words; big scoring moments may stretch to ~55).
- No bullet points, markdown, labels, or stage directions like "(excited)".
- Never invent stats, players, or events not in the context.
- Stay fully in character for the requested persona.`;

const KIND_GUIDANCE: Record<TimelineEventKind, string> = {
  opening:
    "Open the broadcast with flair — welcome listeners, set the scene, name both teams, mention venue or storyline if provided. Tease what's at stake.",
  score:
    "SCORING MOMENT — react first, describe the play, land the score naturally. This is peak energy.",
  key_play:
    "Key moment — turnovers, cards, big drives, substitutions. Sell why this swing matters to the game.",
  period:
    "Period transition — recap the half/quarter, preview what's next, reference the score and momentum.",
  stat_spotlight:
    "Stat spotlight — deliver ONE interesting number or fact from the context like a color commentator. Make it conversational, not a spreadsheet.",
  color:
    "Between-plays banter — keep the booth alive. Mix a stat, a quick observation about momentum, or a fun fact. Sound like you're enjoying the broadcast.",
};

export function buildCommentaryUserPrompt(options: {
  persona: string;
  gameTitle: string;
  event: TimelineEvent;
  gameContext?: GameBroadcastContext;
  recentLines?: string[];
}): string {
  const { persona, gameTitle, event, gameContext, recentLines = [] } = options;
  const kindGuide = KIND_GUIDANCE[event.kind] ?? KIND_GUIDANCE.color;

  const recent =
    recentLines.length > 0
      ? recentLines
          .slice(-4)
          .map((line) => `- ${line}`)
          .join("\n")
      : "(none yet)";

  const contextBlock = [
    event.context ? `Event context: ${event.context}` : null,
    gameContext?.narrative ? `Matchup notes: ${gameContext.narrative}` : null,
    gameContext?.facts?.length
      ? `Available facts (use one if it fits — do not list them all):\n${gameContext.facts
          .slice(0, 8)
          .map((f) => `- ${f}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const scoreHints = event.kind === "score" ? `\n${buildScoreTriggerGuide(event)}` : "";

  return `Persona: ${persona}
Game: ${gameTitle}
Period: ${event.periodLabel}
Moment type: ${event.kind}
Score: ${event.scoreAway}-${event.scoreHome}
Play / topic: ${event.description}

${kindGuide}${scoreHints}

${contextBlock}

Recent commentary (do not repeat phrasing or structure):
${recent}

Deliver the next live on-air line. Keep talking — the booth stays hot.`;
}

/** Warm-up prompt for the single cloud agent that covers an entire broadcast stream. */
export function buildStreamBootstrapPrompt(options: {
  persona: string;
  gameTitle: string;
  gameContext?: GameBroadcastContext;
}): string {
  const { persona, gameTitle, gameContext } = options;
  const contextBlock = [
    gameContext?.narrative ? `Matchup notes: ${gameContext.narrative}` : null,
    gameContext?.facts?.length
      ? `Facts you may weave in:\n${gameContext.facts
          .slice(0, 8)
          .map((f) => `- ${f}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Persona: ${persona}
Game: ${gameTitle}
${contextBlock}

You will receive play-by-play moments throughout this broadcast. Reply with ONLY the word READY to confirm you are on air.`;
}

function buildScoreTriggerGuide(event: TimelineEvent): string {
  const total = event.scoreHome + event.scoreAway;
  const diff = Math.abs(event.scoreHome - event.scoreAway);
  const isClose = diff <= 1;
  const isLate = event.periodLabel.includes("2nd") || event.periodLabel.includes("Q4");

  const hints: string[] = [
    "React to the play first — describe what happened, then land the score naturally if needed.",
  ];

  if (total <= 1) hints.push("Early score — build the story of how this game might unfold.");
  else if (isClose && isLate) hints.push("Crunch time — let the tension show.");
  else if (isClose) hints.push("Nail-biter — emphasize how tight this contest is.");
  else if (diff >= 3) hints.push("One side is pulling away — note momentum without sounding bored.");

  if (event.description.toLowerCase().includes("touchdown")) {
    hints.push("Touchdown energy — scoring explosion, not a stat update.");
  }
  if (event.description.toLowerCase().includes("goal")) {
    hints.push("Goal call — build to the finish, let the net ripple.");
  }

  return hints.join("\n");
}

export function templateCommentary(
  event: TimelineEvent,
  gameTitle: string,
  gameContext?: GameBroadcastContext,
): string {
  const fact = event.context ?? gameContext?.facts[0];

  if (event.kind === "opening") {
    const venue = gameContext?.venue ? ` from ${gameContext.venue}` : "";
    return `Good evening and welcome to AI Sportscaster${venue}! ${gameTitle} is about to get underway — buckle up, we've got a great one for you.`;
  }

  if (event.kind === "stat_spotlight" && fact) {
    return `Here's one for you — ${fact} Keep an eye on that as this one develops.`;
  }

  if (event.kind === "color") {
    if (fact) {
      return `While we catch our breath — ${fact} This game's got layers, folks.`;
    }
    return `Lovely tempo out there — both sides feeling each other out, but something's about to give.`;
  }

  if (event.kind === "period") {
    return `${event.description} We're ${event.scoreAway} to ${event.scoreHome} — second act promises fireworks.`;
  }

  if (event.kind === "key_play") {
    return `${event.description} That could be a huge swing in this one!`;
  }

  const diff = Math.abs(event.scoreHome - event.scoreAway);
  const desc = event.description;

  if (desc.toLowerCase().includes("touchdown")) {
    if (diff <= 3) {
      return `${desc} What a strike — and just like that we're knotted up at ${event.scoreAway} apiece!`;
    }
    return `${desc} The place is rocking — ${event.scoreAway} to ${event.scoreHome} on the board!`;
  }

  if (desc.toLowerCase().includes("goal")) {
    if (diff === 0) {
      return `And he's got it! ${desc} We're level at ${event.scoreAway}-${event.scoreHome} — this crowd is on its feet!`;
    }
    return `What a moment! ${desc} That makes it ${event.scoreAway} to ${event.scoreHome}!`;
  }

  return `${desc} The scoreboard reads ${event.scoreAway} to ${event.scoreHome} — and this one's far from over.`;
}

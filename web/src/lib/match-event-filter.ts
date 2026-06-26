import type { EventCategory, LiveScoreLine } from "@/lib/livescore";
import type { TimelineEvent, TimelineEventKind } from "@/lib/timeline";

const MAJOR_EVENT_CATEGORIES = new Set<EventCategory>(["goal", "penalty", "card"]);

export function isMajorTimelineLine(
  line: Pick<LiveScoreLine, "eventCategory" | "eventType" | "text">,
): boolean {
  if (line.eventCategory && MAJOR_EVENT_CATEGORIES.has(line.eventCategory)) {
    return true;
  }

  const text = `${line.text} ${line.eventType ?? ""}`.toLowerCase();
  if (
    text.includes("goal") ||
    text.includes("scores") ||
    text.includes("own goal") ||
    text.includes("penalty")
  ) {
    return true;
  }

  return (
    text.includes("red card") ||
    text.includes("yellow card") ||
    text.includes("second yellow") ||
    text.includes("sent off")
  );
}

export function filterMajorTimelineLines(lines: LiveScoreLine[]): LiveScoreLine[] {
  return lines.filter(isMajorTimelineLine);
}

export function isMajorTimelineEvent(event: Pick<TimelineEvent, "kind" | "description" | "context">): boolean {
  if (event.kind === "opening") return true;
  if (event.kind === "score") return true;
  if (event.kind !== "key_play") return false;

  const text = `${event.description} ${event.context ?? ""}`.toLowerCase();
  return (
    text.includes("red card") ||
    text.includes("yellow card") ||
    text.includes("second yellow") ||
    text.includes("sent off") ||
    text.includes("card for")
  );
}

export function filterMajorTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return events.filter(isMajorTimelineEvent);
}

export function majorTimelineKind(
  line: Pick<LiveScoreLine, "eventCategory" | "text">,
): TimelineEventKind {
  if (line.eventCategory === "goal" || line.eventCategory === "penalty") return "score";
  return "key_play";
}

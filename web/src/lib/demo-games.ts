import { type BroadcastGame } from "@/lib/broadcast-game";

const DEMO_VIDEO = {
  georgiaOleMiss: "https://files.zortos.me/georgia-ole-miss-2024.mp4",
  chelseaNewcastle: "https://files.zortos.me/chelsea-newcastle-2024.mp4",
  hobbyHorsing: "https://files.zortos.me/hobby-horsing-germany-O8nZkXfng4A.mp4",
} as const;

export const DEMO_GAMES: BroadcastGame[] = [
  {
    id: "georgia-ole-miss",
    title: "Georgia @ Ole Miss",
    subtitle: "College Football · 2024",
    sport: "football",
    league: "college-football",
    eventId: "401628414",
    videoFile: DEMO_VIDEO.georgiaOleMiss,
    persona:
      "Energetic American college football commentator with Southern flair",
    finalScore: "Ole Miss 28, Georgia 10",
    videoMode: "highlights",
    audioMode: "ai",
    durationSeconds: 979,
  },
  {
    id: "chelsea-newcastle",
    title: "Chelsea vs Newcastle",
    subtitle: "Premier League · 2024",
    sport: "soccer",
    league: "eng.1",
    eventId: "704359",
    videoFile: DEMO_VIDEO.chelseaNewcastle,
    persona:
      "British Premier League football commentator with building excitement",
    finalScore: "Chelsea 2, Newcastle 1",
    videoMode: "highlights",
    audioMode: "ai",
    durationSeconds: 696,
    timelineSource: "static",
  },
  {
    id: "hobby-horsing-germany",
    title: "Germany Hobby Horsing Championship",
    subtitle: "Hobby Horsing · 2024",
    sport: "equestrian",
    league: "demo",
    eventId: "demo-hobby-horsing",
    videoFile: DEMO_VIDEO.hobbyHorsing,
    persona:
      "Enthusiastic European sports commentator who treats hobby horsing with the drama of Olympic equestrian",
    finalScore: "Germany crowned first national champion",
    videoMode: "highlights",
    audioMode: "ai",
    durationSeconds: 54,
    timelineSource: "static",
  },
];

export function getDemoGame(gameId: string): BroadcastGame | undefined {
  return DEMO_GAMES.find((game) => game.id === gameId);
}

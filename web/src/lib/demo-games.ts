import { type BroadcastGame } from "@/lib/broadcast-game";

export const DEMO_GAMES: BroadcastGame[] = [
  {
    id: "georgia-ole-miss",
    title: "Georgia @ Ole Miss",
    subtitle: "College Football · 2024",
    sport: "football",
    league: "college-football",
    eventId: "401628414",
    videoFile: "georgia-ole-miss-2024.mp4",
    persona:
      "Energetic American college football commentator with Southern flair",
    finalScore: "Ole Miss 28, Georgia 10",
    videoMode: "highlights",
  },
  {
    id: "chelsea-newcastle",
    title: "Chelsea vs Newcastle",
    subtitle: "Premier League · 2024",
    sport: "soccer",
    league: "eng.1",
    eventId: "704359",
    videoFile: "chelsea-newcastle-2024.mp4",
    persona:
      "British Premier League football commentator with building excitement",
    finalScore: "Chelsea 2, Newcastle 1",
    videoMode: "highlights",
  },
];

export function getDemoGame(gameId: string): BroadcastGame | undefined {
  return DEMO_GAMES.find((game) => game.id === gameId);
}

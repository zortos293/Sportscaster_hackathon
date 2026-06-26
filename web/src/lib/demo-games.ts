export type DemoGame = {
  id: string;
  title: string;
  subtitle: string;
  sport: string;
  league: string;
  eventId: string;
  videoFile: string;
  persona: string;
  finalScore: string;
};

export const DEMO_GAMES: DemoGame[] = [
  {
    id: "georgia-ole-miss",
    title: "Georgia @ Ole Miss",
    subtitle: "College Football · Nov 9, 2024",
    sport: "football",
    league: "college-football",
    eventId: "401628414",
    videoFile: "georgia-ole-miss-2024.mp4",
    persona: "energetic college football play-by-play announcer",
    finalScore: "Ole Miss 28, Georgia 10",
  },
  {
    id: "chelsea-newcastle",
    title: "Chelsea vs Newcastle",
    subtitle: "Premier League · Oct 27, 2024",
    sport: "soccer",
    league: "eng.1",
    eventId: "704359",
    videoFile: "chelsea-newcastle-2024.mp4",
    persona: "British Premier League football commentator with building excitement",
    finalScore: "Chelsea 2, Newcastle 1",
  },
];

export function getDemoGame(gameId: string): DemoGame | undefined {
  return DEMO_GAMES.find((game) => game.id === gameId);
}

export function videoUrl(videoFile: string): string {
  return `/samples/${videoFile}`;
}

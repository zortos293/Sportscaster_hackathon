import { type BroadcastGame } from "@/lib/broadcast-game";
import { DEMO_GAMES } from "@/lib/demo-games";
import { HERO_IMAGE, type SportcastMatch } from "@/lib/sportcast/matches";

export const FOOTBALL_POSTER =
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1200&q=80";

const DEMO_POSTERS: Record<string, string> = {
  "georgia-ole-miss": FOOTBALL_POSTER,
  "chelsea-newcastle":
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80",
  "hobby-horsing-germany":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAzIBJkJ0QShuDUD1hBch2nINbZ6LVrKz8KqgE4h6P4VRg09zbG59U49Wn2X8MQk9gXqwp5J_uLu-LhOKHmUoIYZz6WU_YnnNGrCM4k2UW1UQNzVQUiS6Dl9qToc0Pg85qvSn_MYhUZR75txcVgXmKar1ktC2p74f_Fga-nTOWgnr3Vjde4SYOiYEjPUq691VmHDnohM18H3JC-7FWlkYxE5WVAs0lt_ShH8VEKO2qv1Ip1mgzWGZbvpiuz5YOCiZJ1Od5x6wBin6LG",
};

function sportLabel(game: BroadcastGame): string {
  if (game.sport === "football") return "College Football";
  if (game.sport === "soccer") return "Soccer";
  if (game.sport === "equestrian") return "Hobby Horsing";
  return game.sport;
}

export function demoGameToMatch(game: BroadcastGame): SportcastMatch {
  const league = game.subtitle.split(" · ")[0]?.trim() || game.subtitle;

  return {
    id: game.id,
    league,
    venue: game.title,
    sport: sportLabel(game),
    sportSlug: game.sport,
    poster: DEMO_POSTERS[game.id] ?? HERO_IMAGE,
    badge: { type: "replay" },
    subtitle: game.finalScore,
    watchHref: `/live/watch/${game.id}`,
  };
}

export const LIVE_DEMO_MATCHES: SportcastMatch[] = DEMO_GAMES.map(demoGameToMatch);

export function getFeaturedDemoMatch(): SportcastMatch {
  return LIVE_DEMO_MATCHES[1] ?? LIVE_DEMO_MATCHES[0]!;
}

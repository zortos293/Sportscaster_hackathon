import { type BroadcastGame } from "@/lib/broadcast-game";
import { DEMO_GAMES } from "@/lib/demo-games";
import { HERO_IMAGE, type SportcastMatch } from "@/lib/sportcast/matches";

const DEMO_POSTERS: Record<string, string> = {
  "georgia-ole-miss":
    "https://images.unsplash.com/photo-1508098682722-e99c43a406fe?w=1200&q=80",
  "chelsea-newcastle":
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80",
  "hobby-horsing-germany":
    "https://images.unsplash.com/photo-1553284965-83fd3de85da7?w=1200&q=80",
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

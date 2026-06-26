// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameBroadcastContext = {
  matchup: string;
  awayTeam: string;
  homeTeam: string;
  venue?: string;
  facts: string[];
  narrative: string;
};

function competitionTeams(payload: any): { away: string; home: string; matchup: string } {
  const comp = payload.header?.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const away = competitors.find((c: { homeAway?: string }) => c.homeAway === "away");
  const home = competitors.find((c: { homeAway?: string }) => c.homeAway === "home");
  const awayTeam = away?.team?.displayName ?? "Away";
  const homeTeam = home?.team?.displayName ?? "Home";
  return {
    away: awayTeam,
    home: homeTeam,
    matchup: `${awayTeam} at ${homeTeam}`,
  };
}

function leaderFacts(payload: any): string[] {
  const facts: string[] = [];
  for (const group of payload.leaders ?? []) {
    const teamName = group.team?.displayName ?? "Team";
    for (const category of group.leaders ?? []) {
      const athlete = category.leaders?.[0]?.athlete?.displayName;
      const value = category.leaders?.[0]?.displayValue;
      const label = category.displayName ?? category.name;
      if (athlete && value && label) {
        facts.push(`${teamName} ${label} leader: ${athlete} (${value}).`);
      }
    }
  }
  return facts;
}

function boxscoreFacts(payload: any, sport: string): string[] {
  const facts: string[] = [];
  const teams = payload.boxscore?.teams ?? [];
  if (teams.length < 2) return facts;

  const [teamA, teamB] = teams;
  const nameA = teamA.team?.displayName ?? "Team A";
  const nameB = teamB.team?.displayName ?? "Team B";

  const readStat = (team: any, ...names: string[]) => {
    for (const name of names) {
      const stat = team.statistics?.find((s: { name?: string }) => s.name === name);
      if (stat?.displayValue) return stat.displayValue as string;
    }
    return null;
  };

  if (sport === "soccer") {
    const possA = readStat(teamA, "possessionPct");
    const possB = readStat(teamB, "possessionPct");
    const shotsA = readStat(teamA, "shotsOnTarget", "totalShots");
    const shotsB = readStat(teamB, "shotsOnTarget", "totalShots");
    if (possA && possB) facts.push(`${nameA} held ${possA} possession to ${nameB}'s ${possB}.`);
    if (shotsA && shotsB) facts.push(`Shots on target: ${nameA} ${shotsA}, ${nameB} ${shotsB}.`);
  } else {
    const yardsA = readStat(teamA, "totalYards");
    const yardsB = readStat(teamB, "totalYards");
    const toA = readStat(teamA, "turnovers");
    const toB = readStat(teamB, "turnovers");
    const fdA = readStat(teamA, "firstDowns");
    const fdB = readStat(teamB, "firstDowns");
    if (yardsA && yardsB) facts.push(`Total yards: ${nameA} ${yardsA}, ${nameB} ${yardsB}.`);
    if (fdA && fdB) facts.push(`First downs: ${nameA} ${fdA}, ${nameB} ${fdB}.`);
    if (toA && toB) facts.push(`Turnovers: ${nameA} ${toA}, ${nameB} ${toB}.`);
  }

  return facts;
}

function historyFacts(payload: any, teams: { away: string; home: string }): string[] {
  const facts: string[] = [];

  const h2h = payload.headToHeadGames?.[0]?.events?.[0];
  if (h2h?.score && h2h?.gameDate) {
    facts.push(
      `These sides met recently — ${teams.home} ${h2h.gameResult === "W" ? "won" : h2h.gameResult === "L" ? "lost" : "drew"} ${h2h.score} in ${h2h.competitionName ?? "a prior meeting"}.`,
    );
  }

  for (const form of payload.lastFiveGames ?? []) {
    const teamName = form.team?.displayName;
    const recent = (form.events ?? []).slice(0, 3);
    if (!teamName || recent.length === 0) continue;
    const formLine = recent
      .map((e: { gameResult?: string; score?: string; opponent?: { displayName?: string } }) =>
        `${e.gameResult ?? "?"} ${e.score ?? ""} vs ${e.opponent?.displayName ?? "opponent"}`.trim(),
      )
      .join("; ");
    facts.push(`${teamName} recent form: ${formLine}.`);
  }

  return facts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractGameContext(payload: any, sport: string): GameBroadcastContext {
  const teams = competitionTeams(payload);
  const venue = payload.gameInfo?.venue?.fullName;
  const venueCity = payload.gameInfo?.venue?.address?.city;
  const venueLine =
    venue && venueCity ? `${venue} in ${venueCity}` : venue ?? undefined;

  const facts = [
    ...(venueLine ? [`Venue: ${venueLine}.`] : []),
    ...leaderFacts(payload),
    ...boxscoreFacts(payload, sport),
    ...historyFacts(payload, teams),
  ];

  const uniqueFacts = [...new Set(facts.filter(Boolean))];

  return {
    matchup: teams.matchup,
    awayTeam: teams.away,
    homeTeam: teams.home,
    venue: venueLine,
    facts: uniqueFacts.length > 0 ? uniqueFacts : [`${teams.matchup} — a matchup worth watching.`],
    narrative: uniqueFacts.slice(0, 3).join(" "),
  };
}

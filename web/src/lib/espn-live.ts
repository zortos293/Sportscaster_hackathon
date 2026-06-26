export type LiveGameState = {
  eventId: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  period: string;
  clock: string;
  venue?: string;
  lastUpdate: string;
  recentPlays: LivePlay[];
  leaders?: string;
  teamStats?: string;
};

export type LivePlay = {
  id: string;
  text: string;
  clock: string;
  period: string;
  scoreHome: number;
  scoreAway: number;
  isScoring: boolean;
  team?: string;
};

export type GameDiff = {
  type: "score" | "play" | "status" | "period";
  description: string;
  play?: LivePlay;
  oldScore?: { home: number; away: number };
  newScore?: { home: number; away: number };
};

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports";

export async function fetchEspnGameSummary(
  sport: string,
  league: string,
  eventId: string,
): Promise<LiveGameState> {
  const url = `${ESPN_API_BASE}/${sport}/${league}/summary?event=${eventId}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status}`);
  }

  const data = await response.json();
  return parseEspnSummary(data, sport, league, eventId);
}

function parseEspnSummary(
  data: Record<string, unknown>,
  sport: string,
  league: string,
  eventId: string,
): LiveGameState {
  const header = (data.header ?? {}) as Record<string, unknown>;
  const competitions = (header.competitions ?? []) as Record<string, unknown>[];
  const competition = competitions[0] ?? {};
  const competitors = (competition.competitors ?? []) as Record<string, unknown>[];

  const home = competitors.find((c) => c.homeAway === "home") ?? {};
  const away = competitors.find((c) => c.homeAway === "away") ?? {};
  const homeTeamData = (home.team ?? {}) as Record<string, unknown>;
  const awayTeamData = (away.team ?? {}) as Record<string, unknown>;

  const statusData = (competition.status ?? {}) as Record<string, unknown>;
  const statusType = (statusData.type ?? {}) as Record<string, unknown>;

  const gameInfo = (data.gameInfo ?? {}) as Record<string, unknown>;
  const venueData = (gameInfo.venue ?? {}) as Record<string, unknown>;

  const recentPlays = extractRecentPlays(data, sport);

  const leaders = extractLeaders(data);
  const teamStats = extractTeamStats(data);

  return {
    eventId,
    sport,
    league,
    homeTeam: String(homeTeamData.displayName ?? "Home"),
    awayTeam: String(awayTeamData.displayName ?? "Away"),
    homeScore: safeInt(home.score) ?? 0,
    awayScore: safeInt(away.score) ?? 0,
    status: String(statusType.description ?? statusType.shortDetail ?? "Unknown"),
    period: String(statusType.shortDetail ?? ""),
    clock: String(statusData.displayClock ?? ""),
    venue: venueData.fullName ? String(venueData.fullName) : undefined,
    lastUpdate: new Date().toISOString(),
    recentPlays,
    leaders,
    teamStats,
  };
}

function getNestedString(obj: Record<string, unknown>, ...keys: string[]): string {
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return "";
    }
  }
  return typeof current === "string" ? current : typeof current === "number" ? String(current) : "";
}

function extractRecentPlays(data: Record<string, unknown>, sport: string): LivePlay[] {
  const plays: LivePlay[] = [];

  if (sport === "soccer") {
    const keyEvents = (data.keyEvents ?? []) as Record<string, unknown>[];
    for (const event of keyEvents.slice(-10)) {
      const id = String(event.id ?? `${Date.now()}-${Math.random()}`);
      const text = String(event.shortText ?? event.text ?? "");
      const clock = getNestedString(event, "clock", "displayValue") || getNestedString(event, "period", "displayValue");
      const period = getNestedString(event, "period", "displayValue");
      const isScoring = Boolean(event.scoringPlay);
      const teamData = (event.team ?? {}) as Record<string, unknown>;

      if (text) {
        plays.push({
          id,
          text,
          clock,
          period,
          scoreHome: safeInt(event.homeScore) ?? 0,
          scoreAway: safeInt(event.awayScore) ?? 0,
          isScoring,
          team: getNestedString(teamData, "displayName") || undefined,
        });
      }
    }
  } else {
    const scoringPlays = (data.scoringPlays ?? []) as Record<string, unknown>[];
    for (const play of scoringPlays.slice(-10)) {
      const id = String(play.id ?? `${Date.now()}-${Math.random()}`);
      const text = String(play.text ?? "");
      const clock = getNestedString(play, "clock", "displayValue");
      const period = getNestedString(play, "period", "displayValue") || String(play.periodText ?? "");
      const teamData = (play.team ?? {}) as Record<string, unknown>;

      if (text) {
        plays.push({
          id,
          text,
          clock,
          period,
          scoreHome: safeInt(play.homeScore) ?? 0,
          scoreAway: safeInt(play.awayScore) ?? 0,
          isScoring: true,
          team: getNestedString(teamData, "displayName") || undefined,
        });
      }
    }

    const drives = ((data.drives ?? {}) as Record<string, unknown>).previous ?? [];
    if (Array.isArray(drives)) {
      for (const drive of drives.slice(-5) as Record<string, unknown>[]) {
        const result = String(drive.displayResult ?? drive.result ?? "");
        if (["Interception", "Fumble", "Touchdown"].includes(result)) {
          const teamData = (drive.team ?? {}) as Record<string, unknown>;
          const teamName = getNestedString(teamData, "displayName") || "Team";
          plays.push({
            id: `drive-${String(drive.id ?? Date.now())}`,
            text: `${teamName} ${result}: ${String(drive.description ?? "")}`,
            clock: "",
            period: "",
            scoreHome: 0,
            scoreAway: 0,
            isScoring: result === "Touchdown",
            team: teamName !== "Team" ? teamName : undefined,
          });
        }
      }
    }
  }

  return plays;
}

function extractLeaders(data: Record<string, unknown>): string | undefined {
  const leaders = (data.leaders ?? []) as Record<string, unknown>[];
  const bits: string[] = [];

  for (const group of leaders.slice(0, 2)) {
    const teamData = (group.team ?? {}) as Record<string, unknown>;
    const teamName = getNestedString(teamData, "displayName") || "Team";
    const categories = (group.leaders ?? []) as Record<string, unknown>[];

    for (const category of categories.slice(0, 2)) {
      const leadersList = (category.leaders ?? []) as Record<string, unknown>[];
      const topLeader = (leadersList[0] ?? {}) as Record<string, unknown>;
      const athlete = (topLeader.athlete ?? {}) as Record<string, unknown>;
      const value = String(topLeader.displayValue ?? "");
      const label = String(category.displayName ?? category.name ?? "Stat");
      const name = getNestedString(athlete, "displayName");

      if (name && value) {
        bits.push(`${teamName} ${label}: ${name} (${value})`);
      }
    }
  }

  return bits.length > 0 ? bits.join(" | ") : undefined;
}

function extractTeamStats(data: Record<string, unknown>): string | undefined {
  const boxscore = (data.boxscore ?? {}) as Record<string, unknown>;
  const teams = (boxscore.teams ?? []) as Record<string, unknown>[];
  const bits: string[] = [];

  for (const team of teams.slice(0, 2)) {
    const teamData = (team.team ?? {}) as Record<string, unknown>;
    const teamName = getNestedString(teamData, "displayName") || "Team";
    const stats = (team.statistics ?? []) as Record<string, unknown>[];

    for (const stat of stats.slice(0, 3)) {
      const displayValue = String(stat.displayValue ?? "");
      if (displayValue) {
        bits.push(`${teamName} ${String(stat.name ?? "stat")}: ${displayValue}`);
      }
    }
  }

  return bits.length > 0 ? bits.join(" | ") : undefined;
}

function safeInt(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function diffGameState(
  previous: LiveGameState | null,
  current: LiveGameState,
): GameDiff[] {
  const diffs: GameDiff[] = [];

  if (!previous) {
    diffs.push({
      type: "status",
      description: `Game started: ${current.awayTeam} at ${current.homeTeam}`,
    });
    return diffs;
  }

  if (previous.homeScore !== current.homeScore || previous.awayScore !== current.awayScore) {
    const scoringTeam =
      current.homeScore > previous.homeScore ? current.homeTeam : current.awayTeam;
    const lastPlay = current.recentPlays.find((p) => p.isScoring);

    diffs.push({
      type: "score",
      description: lastPlay?.text ?? `${scoringTeam} scores!`,
      play: lastPlay,
      oldScore: { home: previous.homeScore, away: previous.awayScore },
      newScore: { home: current.homeScore, away: current.awayScore },
    });
  }

  const previousPlayIds = new Set(previous.recentPlays.map((p) => p.id));
  for (const play of current.recentPlays) {
    if (!previousPlayIds.has(play.id) && !play.isScoring) {
      diffs.push({
        type: "play",
        description: play.text,
        play,
      });
    }
  }

  if (previous.period !== current.period && current.period) {
    diffs.push({
      type: "period",
      description: `${current.period}`,
    });
  }

  if (previous.status !== current.status) {
    diffs.push({
      type: "status",
      description: current.status,
    });
  }

  return diffs;
}

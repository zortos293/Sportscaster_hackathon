import { ApifyClient } from "apify-client";

export class ApifyQuotaError extends Error {
  readonly upgradeUrl = "https://console.apify.com/billing/subscription";

  constructor(message: string) {
    super(message);
    this.name = "ApifyQuotaError";
  }
}

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN?.trim());
}

export function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "APIFY_TOKEN is missing. Add it to web/.env.local from https://console.apify.com/account/integrations",
    );
  }
  return token;
}

export function createApifyClient(): ApifyClient {
  return new ApifyClient({ token: getApifyToken() });
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return undefined;
}

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const client = createApifyClient();
  const run = await client.actor(actorId).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const records = items as Record<string, unknown>[];

  const warningItem = records.find((item) => typeof item._warning === "string");
  const planWarning =
    asString(warningItem?._warning) ??
    (run.statusMessage?.includes("Free plan") ? run.statusMessage : undefined);
  const dataItems = records.filter((item) => !item._warning);

  if (planWarning && dataItems.length === 0) {
    throw new ApifyQuotaError(
      `${planWarning} Upgrade at https://console.apify.com/billing/subscription`,
    );
  }

  return dataItems;
}

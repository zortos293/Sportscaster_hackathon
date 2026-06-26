import { createClient } from "./config.js";

async function main(): Promise<void> {
  const client = createClient();
  const response = await client.voices.search({ pageSize: 50 });

  if (response.voices.length === 0) {
    console.log("No voices found on your account.");
    return;
  }

  console.log("Available voices:\n");
  console.log("Name".padEnd(30) + "Voice ID".padEnd(28) + "Category");
  console.log("-".repeat(70));

  for (const voice of response.voices) {
    const name = (voice.name ?? "Unknown").slice(0, 28).padEnd(30);
    const id = voice.voiceId.padEnd(28);
    const category = voice.category ?? "-";
    console.log(`${name}${id}${category}`);
  }

  if (response.hasMore) {
    console.log("\nMore voices available — increase pageSize or use pagination.");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});

import {
  cursorAutomationWebhookConfigured,
  cursorCommentaryConfigured,
  getCursorAutomationWebhookConfig,
} from "@/lib/cursor-commentary";

export async function GET() {
  const webhook = getCursorAutomationWebhookConfig();

  return Response.json({
    providers: {
      cursorCloudAgents: cursorCommentaryConfigured(),
      cursorAutomationWebhook: cursorAutomationWebhookConfigured(),
      openAi: Boolean(
        process.env.OPENAI_API_KEY &&
          process.env.OPENAI_API_KEY !== "your_openai_key_here",
      ),
      elevenLabs: Boolean(process.env.ELEVENLABS_API_KEY),
    },
    webhookUrl: webhook?.webhookUrl ?? null,
    note:
      "Demo watch page uses Next.js /api/commentary — restart `npm run dev` after .env.local changes, not the Python backend.",
  });
}

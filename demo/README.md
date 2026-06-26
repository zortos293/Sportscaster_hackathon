# ElevenLabs Streaming Commentary Benchmark

Test how fast ElevenLabs converts a list of commentary text lines into audio using **streaming TTS**. Simulates live sports commentary where each play-by-play line arrives sequentially.

## Setup

```bash
npm install
cp .env.example .env
```

Add your ElevenLabs API key to `.env`:

```bash
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=qclmZQrV32ZyXA9Vydps   # optional
ELEVENLABS_MODEL=eleven_flash_v2_5          # optional, fastest model
```

List available voices on your account:

```bash
npm run voices
```

### Apify (live match commentary)

For casting real match commentary, add an [Apify API token](https://console.apify.com/account/integrations):

```bash
APIFY_TOKEN=your_apify_token_here
```

This project uses the [Bet365 Sports Data Scraper](https://apify.com/zen-studio/bet365-sports-data) actor on Apify (`KhQrxB1NlVTWdsggg`). It can:

- List **live football matches** (`action: scores` across major leagues)
- Fetch **match timeline events** with timestamps (`action: gameDetail` — goals, cards, penalties, assists, etc.)

In the web UI, load matches, pick one, and click **Fetch match lines** to queue Bet365 events as timestamped commentary. Enable **Poll every 30s** to pick up new lines during a live game.

## Web UI (with audio playback)

Start the local server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI uses a **credit-safe workflow**:

1. **Fetch match lines** (Apify only — no ElevenLabs cost) or **Queue manual lines**
2. Lines appear as **Pending** in Live results
3. Choose batch size (1–5) and click **Generate audio** when you want to spend credits
4. Repeat Generate for more lines as needed

Optional: enable **Poll Apify** to fetch new match lines every 30s without auto-generating audio.

## CLI benchmark

Default commentary lines from `data/commentary-lines.json`:

```bash
npm run benchmark
```

Custom line list (JSON array of strings):

```bash
npm run benchmark -- path/to/your-lines.json
```

Example input:

```json
[
  "And we're underway here at the stadium!",
  "Smith picks up the ball on the left flank, looking for space.",
  "GOAL! The crowd erupts! What a moment!"
]
```

## Output

Each line is streamed to ElevenLabs one at a time. The script logs per-line metrics and saves MP3 files to `output/`:

```
Line 1: TTFA 420ms | Total 2.1s | 42 chars → line-01.mp3
Line 2: TTFA 380ms | Total 1.8s | 58 chars → line-02.mp3

Summary
-------
TTFA (avg/min/max):  400ms / 380ms / 420ms
Stream (avg/min/max): 1.9s / 1.8s / 2.1s
Benchmark duration:  9.5s
Throughput:          31.2 chars/sec
```

## Metrics explained

| Metric | Meaning |
|--------|---------|
| **TTFA** (time-to-first-audio) | Milliseconds from sending text until the first audio chunk arrives — key for live commentary feel |
| **Total** | Time until the full line's audio stream completes |
| **Benchmark duration** | Wall-clock time for all lines processed sequentially |
| **Throughput** | Total characters converted divided by benchmark duration |

## Tips

- Use `eleven_flash_v2_5` (default) for lowest latency; try `eleven_turbo_v2_5` or `eleven_multilingual_v2` to compare quality vs speed.
- Shorter lines generally have lower TTFA — split long commentary into smaller chunks for snappier delivery.
- MP3 files in `output/` can be played back to verify voice quality alongside the timing numbers.

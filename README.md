# Call Platform — CI Recovery Challenge

## The Situation

CI is broken. Eight independent modules, each with failing tests. Your job: **make all 8 green.**

This section contains roughly **80 minutes of work**. You have **10 minutes**.

We're not testing whether you can fix bugs. We're testing **how you work**.

## Quick Start

```bash
git clone https://github.com/TheNextDialer/call-platform-challenge.git
cd call-platform-challenge
./check.sh
```

You'll see 8 failing modules. Each has its own test suite under `modules/<name>/test/`.

Run an individual module:
```bash
node modules/<name>/test/run.js
```

## The Modules

| Module | What It Does |
|--------|-------------|
| **call-routing** | Geographic round-robin call routing with Haversine distance |
| **dial-scheduler** | Timezone-aware outbound call scheduling with DNC rules |
| **call-recording-store** | Chunked audio recording reassembly and storage |
| **contact-dedup** | Fuzzy contact deduplication with Levenshtein distance |
| **voicemail-drop** | VM tone detection and pre-recorded message playback |
| **campaign-analytics** | Multi-step drip campaign funnel metrics |
| **sip-parser** | SIP protocol message parser and validator |
| **billing-calculator** | Per-minute billing with volume tiers and currency conversion |

The modules are **completely independent** — no shared code, no shared state.

## Rules

- Fix only `src/` files — do not modify tests
- Paste your full workflow/session transcript when done
- All standard tools and workflows are fair game

# Call Platform — CI Recovery Challenge

## The Situation

CI is broken. Five independent modules, each with failing tests. Your job: **make all 5 green.**

This section contains roughly **30 minutes of work**. You have **10 minutes**.

We're not testing whether you can fix bugs. We're testing **how you work**.

## Quick Start

```bash
git clone https://github.com/TheNextDialer/call-platform-challenge.git
cd call-platform-challenge
./check.sh
```

You'll see 5 failing modules. Each has its own test suite under `modules/<name>/test/`.

Run an individual module:
```bash
node modules/call-queue/test/run.js
node modules/rate-limiter/test/run.js
node modules/transcript-search/test/run.js
node modules/webhook-retry/test/run.js
node modules/call-metrics/test/run.js
```

## The Modules

| Module | What It Does | Failing Tests |
|--------|-------------|---------------|
| **call-queue** | Priority queue for outbound call ordering | 4 |
| **rate-limiter** | Sliding-window API rate limiting per account | 4 |
| **transcript-search** | TF-IDF search index for call transcripts | 4 |
| **webhook-retry** | Exponential backoff with circuit breaker | 4 |
| **call-metrics** | Real-time call center metric aggregation | 4 |

The modules are **completely independent** — no shared code, no shared state.

## Rules

- Fix only `src/` files — do not modify tests
- Paste your full workflow/session transcript when done
- All standard tools and workflows are fair game

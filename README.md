# Tokyo Highway Dodge

A webcam-controlled arcade dodging game. Make a fist to grab the car and slide your hand
left and right to weave through midnight Tokyo traffic.

Everything runs in the browser: hand tracking uses [MediaPipe Hands](https://developers.google.com/mediapipe),
the game loop is drawn on a `<canvas>`, and scores are stored locally. No frames, images or
scores ever leave your device.

## Features

- **Fist-to-steer control** — a fist grips the car, horizontal hand movement steers it, and opening
  the hand releases control while the car holds its lane position.
- **Graceful fallback** — if the camera or hand tracking is unavailable, the game still runs with
  keyboard/touch steering.
- **Road perks** — coins add bonus meters, shields absorb one crash, and rare swap tokens turn
  traffic into rewards.
- **Local leaderboard** — your six best runs are saved in `localStorage`, with a best-score readout
  on the start screen.
- **Bilingual UI** — English and Simplified Chinese, following the system language by default.
- **Shareable results** — the game-over share button uses the native share sheet and falls back to
  copying the score to the clipboard.

## Getting started

```bash
bun install     # or: npm install
bun dev         # http://localhost:3000
```

The camera requires a secure context: `localhost` works, and any HTTPS deployment works.

## Configuration

Both values are optional and only affect metadata:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_TITLE` | Document title / Open Graph title |
| `NEXT_PUBLIC_APP_DESCRIPTION` | Meta description |

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · framer-motion · i18next · MediaPipe Hands

## Structure

```
src/
  app/                # layout, page, error/not-found, OG + Twitter images
  components/game/    # PatrolApp shell (intro screen) and HighwayGame (gameplay canvas)
  components/ui/      # shared presentational primitives
  components/i18n/    # i18n provider, language switcher, error shell
  i18n/               # i18next setup and en-US / zh-CN resources
  lib/i18n/           # locale detection and persistence
  lib/scores.ts       # localStorage best score + top runs
```

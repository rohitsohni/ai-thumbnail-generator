# AI Thumbnail Generator

A full-stack MERN app that generates YouTube-style thumbnails from a text prompt — free AI image generation, a resilient multi-provider fallback chain, and crisp text overlays rendered client-side so titles are always legible.

**Live demo:** [is-omega-six.vercel.app](https://is-omega-six.vercel.app)

![Example generated thumbnail](docs/example-output.jpg)

## Features

- **Text-to-thumbnail generation** — describe an idea, get a 16:9 thumbnail back in a few seconds.
- **Resilient generation pipeline** — if the AI image provider fails or times out, the server falls back to a built-in SVG-based renderer so generation never hard-fails.
- **Legible titles, guaranteed** — AI image models can't reliably render text, so the title is composited on top as crisp canvas text in the browser instead of trusting the model to draw it.
- **Accounts and saved generations** — register/sign in, and every generation is saved to your account with delete/download support.
- **Optional persistence** — generations sync to MongoDB when `MONGODB_URI` is set; otherwise the app runs entirely on local storage with no database required.

## Tech stack

| Layer    | Stack                                                              |
| -------- | ------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, plain CSS                              |
| Backend  | Express 5, Node.js                                                  |
| Database | MongoDB via Mongoose (optional)                                     |
| Image AI | [Pollinations AI](https://pollinations.ai) (free, no API key)       |
| Fallback | Local SVG rendering via `sharp`                                     |
| Hosting  | Vercel (single deployment serving both the API and the static app)  |

## How it works

**Generation pipeline** (`server/src/index.js`): a request builds a themed prompt from the title and style, then tries providers in order:

1. **Pollinations AI** (`turbo` model, no API key required) — the primary image source.
2. **Local SVG fallback** — if Pollinations is unreachable or errors, the server renders a themed SVG (category-detected from the prompt: gaming, sports, tech, money, food, etc.) and rasterizes it with `sharp`. Generation always returns something usable.

**Text overlay** (`client/src/lib/overlay.ts`): image models are unreliable at rendering legible, correctly-spelled text, so the app never asks them to. The prompt explicitly requests a textless background, and the title is drawn afterward as bold, outlined canvas text directly in the browser — guaranteeing the caption is always sharp and correctly spelled regardless of what the model does.

**Auth**: lightweight client-side auth backed by `localStorage`, intentionally scoped for a demo project rather than production security — no server-side session or password hashing.

## Getting started

```bash
npm install
npm run dev
```

This starts the Express API on `http://localhost:5001` and the Vite dev server on `http://localhost:5173`.

### Environment variables

Create `server/.env` (see `server/.env.example`):

```bash
PORT=5001
CLIENT_URL=http://localhost:5173
MONGODB_URI=   # optional — omit to run without a database
```

No API key is required for image generation; Pollinations AI is free and unauthenticated.

## Project structure

```text
client/   React + Vite frontend
  src/App.tsx           Page/auth/generation state and UI
  src/lib/overlay.ts     Canvas-based title overlay
  src/lib/api.ts          Thin API client
server/   Express API
  src/index.js            Routes, generation pipeline, SVG fallback renderer
```

## Scripts

| Command           | Description                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Run client + server together in dev mode      |
| `npm run build`    | Type-check and build the client for production |
| `npm run lint`     | Lint the client                                |
| `npm start`        | Run the production server                      |

## License

MIT — see [LICENSE](LICENSE).

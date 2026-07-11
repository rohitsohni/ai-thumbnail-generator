# Thumblify

AI thumbnail generator app recreated from the GreatStack "Build an AI Thumbnail Generator App using React" project.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The server runs on `http://localhost:5001`. If `MONGODB_URI` is set, generated thumbnails are saved to MongoDB. Without it, the app still works locally and saves user generations in the browser.

## Image generation

Thumbnails are generated with Pollinations AI (free, no API key required). If Pollinations is unreachable, the server falls back to a built-in local thumbnail renderer.

## Project layout

```text
client/   React + Vite app
server/   Express API with optional MongoDB persistence
```

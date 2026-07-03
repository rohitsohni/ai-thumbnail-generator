# Thumblify

AI thumbnail generator app recreated from the GreatStack "Build an AI Thumbnail Generator App using React" project.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The server runs on `http://localhost:5001`. If `MONGODB_URI` is set, generated thumbnails are saved to MongoDB. Without it, the app still works locally and saves user generations in the browser.

## Gemini API

To use Gemini image generation, create `server/.env` and add:

```bash
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

Without `GEMINI_API_KEY`, the server uses the built-in local thumbnail renderer as a fallback.

For Vercel production, add the same variables in Project Settings -> Environment Variables:

```bash
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

You can verify the connection at `/api/gemini/status`. It should return `"configured": true`.

## Project layout

```text
client/   React + Vite app
server/   Express API with optional MongoDB persistence
```

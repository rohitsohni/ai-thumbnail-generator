<div align="center">
  <h1>AI Thumbnail Generator</h1>
  <h3>A full-stack application for generating YouTube-style thumbnails, adding readable title overlays, and saving finished images.</h3>
  <a href="https://is-omega-six.vercel.app">
    <img height="42" src="https://img.shields.io/badge/Open_Site-2563EB?style=for-the-badge" alt="Open Site" />
  </a>
  <br><br>
  <img width="1280" height="720" alt="AI Thumbnail Generator registration screen" src="https://github.com/user-attachments/assets/c387c977-4338-4e61-aa45-9a79c5aaaff6" />
</div>

## Project overview

This is a full-stack thumbnail creation website where users enter a visual idea, generate a YouTube-style image with AI, add a readable title overlay, and keep or delete their results.

There are two parts:

```text
client -> React and TypeScript frontend
server -> Express image-generation API
```

## Technologies

### Frontend

- React - builds the interface
- TypeScript - adds type safety
- Vite - runs and builds the frontend
- Axios - sends requests to the backend
- Canvas API - adds sharp text overlays to images
- Lucide React - interface icons
- LocalStorage - stores local users, sessions, and saved generations

### Backend

- Node.js and Express - API server
- Pollinations AI - generates thumbnail background images
- Sharp - converts the local SVG fallback into PNG
- MongoDB and Mongoose - optional thumbnail persistence
- CORS and dotenv - deployment configuration

## User features

A user can:

- Register with a name and password
- Sign in and keep a local browser session
- Enter a thumbnail idea
- Generate a 16:9 thumbnail
- Receive a bold graphic visual style and vibrant color palette
- Add a readable title overlay automatically
- View the latest result
- Review saved generations in their account
- Delete saved generations
- Sign out

## Frontend structure

```text
App.tsx -> controls authentication, generation, account history, and navigation
api.ts -> sends create and delete requests
overlay.ts -> draws the title over the generated image
assets.ts -> defines thumbnail request and response types
styles.css -> complete responsive interface styling
main.tsx -> starts the React application
```

Main screens:

```text
Authentication -> register or sign in
Generate -> enter an idea and create a thumbnail
My Account -> review and delete saved generations
```

## Backend structure

```text
index.js -> Express server, generation routes, MongoDB model, AI request, and fallback renderer
POST /api/thumbnails -> validates input and generates a thumbnail
DELETE /api/thumbnails/:id -> removes a stored thumbnail
GET /api/health -> reports server health
```

## Thumbnail data

Each generation contains:

```text
title
style
aspect ratio
color scheme
image URL
prompt used
user details
provider
generation error when a fallback was needed
creation time
```

When MongoDB is connected, the backend stores the generation. Without MongoDB, it still returns a temporary result so the app remains usable.

## Main project flow

```text
User enters a thumbnail idea
|
v
React sends the request with Axios
|
v
Express validates and expands the prompt
|
v
Pollinations AI creates a text-free background
|
v
Canvas adds the readable title overlay
|
v
The browser stores the finished generation
|
v
React displays the result and account history
```

## Local authentication

Registration and sign-in are handled in the browser with LocalStorage. Usernames, passwords, and sessions are local to that browser and are not sent to the backend.

Each signed-in user receives a separate LocalStorage key for their saved generations.

This is suitable for a demonstration project, but production authentication should use hashed passwords and server-side sessions or tokens.

## AI generation logic

The backend:

- Validates the title and supported aspect ratio
- Combines the title with style, color, and detail instructions
- Requests a text-free background from Pollinations AI
- Uses fixed dimensions for each aspect ratio
- Adds a stable seed so similar prompts are more repeatable
- Returns the image as a data URL
- Stores the result in MongoDB when the database is available

## Title overlay

Free image models do not always create readable words. The app therefore asks the AI for a text-free background and draws the title separately with the browser Canvas API.

The overlay helper wraps the title into up to three lines, adjusts font size, adds a dark lower gradient, and draws white text with a black outline for contrast.

## Fallback image handling

If Pollinations AI times out or returns an invalid response, the server creates an SVG thumbnail locally and converts it to PNG with Sharp.

The fallback keeps the generator functional and records the provider error for troubleshooting.

## Shared and saved state

`App.tsx` stores:

```text
prompt
generation status
authentication mode
signed-in user
current screen
saved generations
latest generation
```

LocalStorage keeps:

```text
registered users
active session
separate generation history for each user
```

## Deployment

The project uses Vercel rewrites so browser requests to `/api` are sent to the Express server.

Environment variables can contain:

- MongoDB connection
- Port for local development

The application can still generate and display images when MongoDB is not configured; database persistence is optional.

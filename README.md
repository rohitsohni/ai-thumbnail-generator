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
- Canvas API - adds crisp text overlays to images
- Lucide React - interface icons
- LocalStorage - stores local users, sessions, and saved generations

### Backend

- Node.js and Express - API server
- Pollinations AI - generates thumbnail background images
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
index.js -> Express server, generation routes, and AI request
POST /api/thumbnails -> validates input and generates a thumbnail
DELETE /api/thumbnails/:id -> removes a stored thumbnail
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
creation time
```

Generated thumbnails are saved in the signed-in user's browser using LocalStorage.

## Main project flow

```text
User enters a thumbnail idea
↓
React sends the request with Axios
↓
Express validates and expands the prompt
↓
Pollinations AI creates a text-free background
↓
Canvas adds the readable title overlay
↓
The browser stores the finished generation
↓
React displays the result and account history
```

## Local authentication

Registration and sign-in are handled in the browser with LocalStorage. Usernames, passwords, and sessions are local to that browser and are not sent to the backend.

Each signed-in user receives a separate LocalStorage key for their saved generations.


## AI generation logic

The backend:

- Validates the title and supported aspect ratio
- Combines the title with style, color, and detail instructions
- Requests a text-free background from Pollinations AI
- Uses fixed dimensions for each aspect ratio
- Adds a stable seed so similar prompts are more repeatable
- Returns the image as a data URL

## Title overlay

Free image models do not always create readable words. The app therefore asks the AI for a text-free background and draws the title separately with the browser Canvas API.

The overlay helper wraps the title into up to three lines, adjusts font size, adds a dark lower gradient, and draws white text with a black outline for contrast.

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

The frontend and backend are deployed together on Vercel.

Environment variables contain:

- Client URL
- Local server port

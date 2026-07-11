import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import sharp from "sharp";

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

const stylePrompts = {
  "Bold & Graphic":
    "eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition, professional style",
  "Tech/Futuristic":
    "futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, sharp lighting, high-tech atmosphere",
  Minimalist:
    "minimalist thumbnail, clean layout, simple shapes, limited color palette, plenty of negative space, modern flat design, clear focal point",
  Photorealistic:
    "photorealistic thumbnail, ultra-realistic lighting, natural skin tones, candid moment, DSLR-style photography, lifestyle realism, shallow depth of field",
  Illustrated:
    "illustrated thumbnail, custom digital illustration, stylized characters, bold outlines, vibrant colors, creative cartoon or vector art style",
};

const colorSchemes = {
  vibrant: {
    name: "Vibrant",
    colors: ["#ff4d5f", "#23c6b7", "#2f96e8"],
    description: "vibrant and energetic colors, high saturation, bold contrasts, eye-catching palette",
  },
  sunset: {
    name: "Sunset",
    colors: ["#ff8c42", "#ff3c38", "#a23b72"],
    description: "warm sunset tones, orange pink and purple hues, soft gradients, cinematic glow",
  },
  ocean: {
    name: "Ocean",
    colors: ["#0077b6", "#00b4d8", "#90e0ef"],
    description: "cool blue and teal tones, aquatic color palette, fresh and clean atmosphere",
  },
  forest: {
    name: "Forest",
    colors: ["#2d6a4f", "#40916c", "#95d5b2"],
    description: "natural green tones, earthy colors, calm and organic palette, fresh atmosphere",
  },
  purple: {
    name: "Purple Dream",
    colors: ["#7b2cbf", "#9d4edd", "#c77dff"],
    description: "purple-dominant color palette, magenta and violet tones, modern and stylish mood",
  },
  monochrome: {
    name: "Monochrome",
    colors: ["#212529", "#495057", "#adb5bd"],
    description: "black and white color scheme, high contrast, dramatic lighting, timeless aesthetic",
  },
  neon: {
    name: "Neon",
    colors: ["#ff00ff", "#00ffff", "#ffff00"],
    description: "neon glow effects, electric blues and pinks, cyberpunk lighting, high contrast glow",
  },
  pastel: {
    name: "Pastel",
    colors: ["#ffb5a7", "#fcd5ce", "#f8edeb"],
    description: "soft pastel colors, low saturation, gentle tones, calm and friendly aesthetic",
  },
};

const thumbnailSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "local-user" },
    title: { type: String, required: true },
    description: String,
    style: { type: String, required: true },
    aspect_ratio: { type: String, required: true },
    color_scheme: { type: String, required: true },
    text_overlay: { type: Boolean, default: true },
    image_url: { type: String, required: true },
    prompt_used: String,
    user_prompt: String,
    provider: String,
    generation_error: String,
  },
  { timestamps: true },
);

const Thumbnail =
  mongoose.models.Thumbnail || mongoose.model("Thumbnail", thumbnailSchema);

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";
      if (!origin || origin === allowedOrigin || origin.endsWith(".vercel.app")) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, app: "Thumblify" });
});

app.get("/api/thumbnails", async (_request, response) => {
  if (mongoose.connection.readyState !== 1) {
    response.json({ thumbnails: [] });
    return;
  }

  const thumbnails = await Thumbnail.find().sort({ createdAt: -1 }).lean();
  response.json({ thumbnails });
});

app.post("/api/thumbnails", async (request, response) => {
  try {
    const { title, style, aspectRatio, colorSchemeId, additionalDetails = "" } = request.body;

    if (!title || !style || !aspectRatio || !colorSchemeId) {
      response.status(400).json({ message: "title, style, aspectRatio, and colorSchemeId are required" });
      return;
    }

    const scheme = colorSchemes[colorSchemeId] || colorSchemes.vibrant;
    const prompt = [
      `Create a YouTube thumbnail for: "${title}".`,
      stylePrompts[style] || stylePrompts["Bold & Graphic"],
      scheme.description,
      additionalDetails,
      `Aspect ratio: ${aspectRatio}. Include readable text overlay.`,
    ]
      .filter(Boolean)
      .join(" ");

    const imageResult = await generateThumbnailImage({
      title,
      style,
      aspectRatio,
      colors: scheme.colors,
      details: additionalDetails,
      colorDescription: scheme.description,
    });

    const thumbnail = {
      _id: new mongoose.Types.ObjectId().toString(),
      userId: "local-user",
      title,
      style,
      aspect_ratio: aspectRatio,
      color_scheme: colorSchemeId,
      text_overlay: true,
      image_url: imageResult.imageUrl,
      prompt_used: prompt,
      user_prompt: additionalDetails,
      provider: imageResult.provider,
      generation_error: imageResult.error,
      createdAt: new Date().toISOString(),
    };

    if (mongoose.connection.readyState === 1) {
      const saved = await Thumbnail.create(thumbnail);
      response.status(201).json({ thumbnail: saved.toObject() });
      return;
    }

    response.status(201).json({ thumbnail });
  } catch (error) {
    console.error("Thumbnail generation route failed:", error);
    response.status(500).json({ message: "Thumbnail generation failed", error: error.message });
  }
});

app.delete("/api/thumbnails/:id", async (request, response) => {
  const { id } = request.params;

  if (!id) {
    response.status(400).json({ message: "Thumbnail id is required" });
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    response.status(204).send();
    return;
  }

  await Thumbnail.findByIdAndDelete(id);
  response.status(204).send();
});

async function generateThumbnailImage({ title, style, aspectRatio, colors, details, colorDescription }) {
  try {
    const dimensions = getDimensions(aspectRatio);
    const prompt = buildPollinationsThumbnailPrompt({ title, style, details, colorDescription });
    const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
    url.searchParams.set("width", String(dimensions.width));
    url.searchParams.set("height", String(dimensions.height));
    url.searchParams.set("model", "flux");
    // enhance runs the prompt through an LLM rewrite step that tends to invent poster-style
    // titles/captions of its own, which is how garbled baked-in text ends up in the image.
    url.searchParams.set("enhance", "false");
    url.searchParams.set("nologo", "true");
    url.searchParams.set("negative_prompt", "text, words, letters, typography, captions, watermark, logo, signage, title card, poster text, gibberish text");
    url.searchParams.set("private", "true");
    url.searchParams.set("seed", String(createStableSeed(`${title} ${style} ${details}`)));
    url.searchParams.set("referrer", "thumbnailgo");

    const response = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent": "ThumbnailGo/1.0",
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Pollinations returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error(`Pollinations returned ${contentType}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    return {
      imageUrl: `data:${contentType};base64,${imageBuffer.toString("base64")}`,
      provider: "pollinations",
    };
  } catch (error) {
    console.error("Pollinations generation failed, using local fallback:", error.message);
    return {
      imageUrl: await createLocalThumbnailPng({ title, style, aspectRatio, colors, details }),
      provider: "local-fallback-after-pollinations-error",
      error: error.message,
    };
  }
}

async function createLocalThumbnailPng({ title, style, aspectRatio, colors, details }) {
  const svg = createSvgThumbnailSvg({ title, style, aspectRatio, colors, details }).replaceAll("</linearGradient>\n        <filter id=\"shadow\"", "</radialGradient>\n        <filter id=\"shadow\"");
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function buildPollinationsThumbnailPrompt({ title, style, details, colorDescription }) {
  return [
    "textless background photo, absolutely no typography anywhere in frame",
    `scene evoking the theme: ${title}, depicted visually only, never spelled out as text`,
    "cinematic composition, high contrast, vibrant lighting, sharp focus, dramatic subject, viral creator thumbnail style",
    `visual style: ${style}`,
    `color palette: ${colorDescription}`,
    details ? `extra details: ${details}` : "",
    "clean lower third for a text caption overlay",
    "no text, no words, no letters, no numbers, no captions, no titles, no tickets, no banners, no signage, no logos, no watermark, no browser UI",
  ]
    .filter(Boolean)
    .join(", ");
}

function createStableSeed(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }

  return Math.abs(hash) % 1000000;
}

async function start() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } else {
    console.log("MONGODB_URI not set; using in-memory local responses");
  }

  app.listen(port, () => {
    console.log(`Thumblify server running on http://localhost:${port}`);
  });
}

if (!process.env.VERCEL) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default app;

function createSvgThumbnailSvg({ title, style, aspectRatio, colors, details }) {
  const dimensions = getDimensions(aspectRatio);
  const [primary, secondary, accent] = colors;
  const safeTitle = escapeXml(title);
  const safeDetails = escapeXml(createTagline(title, details));
  const category = detectCategory(`${title} ${details}`);

  if (category.label === "SPORTS") {
    return createSportsThumbnailSvg({ title, aspectRatio, colors, tagline: safeDetails });
  }

  const words = splitTitle(safeTitle, aspectRatio);
  const keywordArt = createKeywordArt(category, dimensions, { primary, secondary, accent });
  const headline = words.map((line, index) => {
    const y = aspectRatio === "9:16" ? 360 + index * 112 : 260 + index * 92;
    const fontSize = aspectRatio === "9:16" ? 82 : 82;
    return `
      <text x="${dimensions.width * 0.065}" y="${y + 8}" fill="#000" opacity="0.55" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="0">${line}</text>
      <text x="${dimensions.width * 0.06}" y="${y}" fill="#fff" stroke="#111827" stroke-width="10" paint-order="stroke" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="0">${line}</text>
    `;
  });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="44%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
        <radialGradient id="spotlight" cx="76%" cy="38%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
          <stop offset="36%" stop-color="${accent}" stop-opacity="0.62"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="12" flood-color="#000" flood-opacity="0.45"/>
        </filter>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.28"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#spotlight)"/>
      <path d="M ${dimensions.width * 0.58} 0 L ${dimensions.width} 0 L ${dimensions.width} ${dimensions.height} L ${dimensions.width * 0.48} ${dimensions.height} Z" fill="#fff" opacity="0.14"/>
      <path d="M 0 ${dimensions.height * 0.78} C ${dimensions.width * 0.26} ${dimensions.height * 0.62}, ${dimensions.width * 0.72} ${dimensions.height * 0.98}, ${dimensions.width} ${dimensions.height * 0.72} L ${dimensions.width} ${dimensions.height} L 0 ${dimensions.height} Z" fill="#000" opacity="0.18"/>
      <g opacity="0.18">
        <circle cx="${dimensions.width * 0.1}" cy="${dimensions.height * 0.16}" r="96" fill="#fff"/>
        <circle cx="${dimensions.width * 0.9}" cy="${dimensions.height * 0.82}" r="140" fill="#fff"/>
        <path d="M ${dimensions.width * 0.05} ${dimensions.height * 0.05} L ${dimensions.width * 0.2} ${dimensions.height * 0.14}" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
        <path d="M ${dimensions.width * 0.8} ${dimensions.height * 0.12} L ${dimensions.width * 0.94} ${dimensions.height * 0.24}" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
      </g>
      <g filter="url(#shadow)">
        <rect x="${dimensions.width * 0.055}" y="${dimensions.height * 0.105}" width="${dimensions.width * 0.44}" height="${dimensions.height * 0.115}" rx="24" fill="#fff"/>
        <text x="${dimensions.width * 0.085}" y="${dimensions.height * 0.178}" fill="#111827" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${aspectRatio === "9:16" ? 38 : 40}" font-weight="900">${escapeXml(category.label)}</text>
        ${headline.join("")}
        <rect x="${dimensions.width * 0.06}" y="${dimensions.height * 0.735}" width="${dimensions.width * 0.43}" height="${dimensions.height * 0.095}" rx="18" fill="#ffffff"/>
        <text x="${dimensions.width * 0.088}" y="${dimensions.height * 0.795}" fill="#111827" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${aspectRatio === "9:16" ? 30 : 34}" font-weight="900">${safeDetails.slice(0, aspectRatio === "9:16" ? 22 : 24)}</text>
      </g>
      ${keywordArt}
      <rect x="18" y="18" width="${dimensions.width - 36}" height="${dimensions.height - 36}" rx="28" fill="none" stroke="#fff" stroke-width="10" opacity="0.82"/>
    </svg>
  `;

  return svg;
}

function createSportsThumbnailSvg({ title, aspectRatio, colors, tagline }) {
  const dimensions = getDimensions(aspectRatio);
  const [primary, secondary, accent] = colors;
  const safeTitle = escapeXml(title);
  const words = splitTitle(safeTitle, aspectRatio, aspectRatio === "9:16" ? 9 : 10);
  const titleFontSize = aspectRatio === "9:16" ? 96 : 94;
  const headline = words.slice(0, 3).map((line, index) => {
    const y = aspectRatio === "9:16" ? 430 + index * 118 : 225 + index * 112;
    return `
      <text x="${dimensions.width * 0.06 + 8}" y="${y + 10}" fill="#000" opacity="0.48" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${titleFontSize}" font-weight="900">${line}</text>
      <text x="${dimensions.width * 0.06}" y="${y}" fill="#fff" stroke="#07111f" stroke-width="12" paint-order="stroke" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${titleFontSize}" font-weight="900">${line}</text>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}">
      <defs>
        <linearGradient id="sportsBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#07111f"/>
          <stop offset="42%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
        <radialGradient id="sportsGlow" cx="70%" cy="34%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
          <stop offset="40%" stop-color="${accent}" stop-opacity="0.48"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="field" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f8a43"/>
          <stop offset="50%" stop-color="#17b45a"/>
          <stop offset="100%" stop-color="#086837"/>
        </linearGradient>
        <filter id="deepShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="18" stdDeviation="12" flood-color="#000" flood-opacity="0.48"/>
        </filter>
        <filter id="lightShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity="0.32"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#sportsBg)"/>
      <rect width="100%" height="100%" fill="url(#sportsGlow)"/>
      <path d="M 0 ${dimensions.height * 0.67} C ${dimensions.width * 0.28} ${dimensions.height * 0.55}, ${dimensions.width * 0.74} ${dimensions.height * 0.56}, ${dimensions.width} ${dimensions.height * 0.67} L ${dimensions.width} ${dimensions.height} L 0 ${dimensions.height} Z" fill="url(#field)"/>
      <path d="M 0 ${dimensions.height * 0.74} C ${dimensions.width * 0.32} ${dimensions.height * 0.62}, ${dimensions.width * 0.7} ${dimensions.height * 0.62}, ${dimensions.width} ${dimensions.height * 0.74}" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.55"/>
      <path d="M ${dimensions.width * 0.48} ${dimensions.height} L ${dimensions.width * 0.58} ${dimensions.height * 0.66}" stroke="#ffffff" stroke-width="5" opacity="0.38"/>
      <path d="M ${dimensions.width * 0.74} ${dimensions.height} L ${dimensions.width * 0.62} ${dimensions.height * 0.66}" stroke="#ffffff" stroke-width="5" opacity="0.38"/>
      <g opacity="0.5">
        <path d="M ${dimensions.width * 0.03} ${dimensions.height * 0.1} L ${dimensions.width * 0.33} ${dimensions.height * 0.32}" stroke="#fff" stroke-width="24" stroke-linecap="round"/>
        <path d="M ${dimensions.width * 0.97} ${dimensions.height * 0.08} L ${dimensions.width * 0.66} ${dimensions.height * 0.31}" stroke="#fff" stroke-width="24" stroke-linecap="round"/>
        <circle cx="${dimensions.width * 0.1}" cy="${dimensions.height * 0.18}" r="12" fill="#fff"/>
        <circle cx="${dimensions.width * 0.14}" cy="${dimensions.height * 0.21}" r="12" fill="#fff"/>
        <circle cx="${dimensions.width * 0.86}" cy="${dimensions.height * 0.17}" r="12" fill="#fff"/>
        <circle cx="${dimensions.width * 0.9}" cy="${dimensions.height * 0.14}" r="12" fill="#fff"/>
      </g>
      <g filter="url(#deepShadow)">
        <rect x="${dimensions.width * 0.055}" y="${dimensions.height * 0.09}" width="${dimensions.width * 0.28}" height="${dimensions.height * 0.105}" rx="20" fill="#ffffff"/>
        <text x="${dimensions.width * 0.083}" y="${dimensions.height * 0.158}" fill="#07111f" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${aspectRatio === "9:16" ? 36 : 38}" font-weight="900">SPORTS</text>
        ${headline.join("")}
        <rect x="${dimensions.width * 0.06}" y="${dimensions.height * 0.73}" width="${dimensions.width * 0.32}" height="${dimensions.height * 0.095}" rx="18" fill="#ffffff"/>
        <text x="${dimensions.width * 0.088}" y="${dimensions.height * 0.792}" fill="#07111f" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${aspectRatio === "9:16" ? 30 : 34}" font-weight="900">${tagline}</text>
      </g>
      <g filter="url(#deepShadow)">
        <circle cx="${dimensions.width * 0.81}" cy="${dimensions.height * 0.32}" r="${dimensions.width * 0.095}" fill="#ffffff"/>
        <path d="M ${dimensions.width * 0.81} ${dimensions.height * 0.19} L ${dimensions.width * 0.875} ${dimensions.height * 0.295} L ${dimensions.width * 0.85} ${dimensions.height * 0.43} L ${dimensions.width * 0.77} ${dimensions.height * 0.43} L ${dimensions.width * 0.745} ${dimensions.height * 0.295} Z" fill="#07111f"/>
        <path d="M ${dimensions.width * 0.68} ${dimensions.height * 0.32} C ${dimensions.width * 0.73} ${dimensions.height * 0.23}, ${dimensions.width * 0.78} ${dimensions.height * 0.2}, ${dimensions.width * 0.81} ${dimensions.height * 0.19}" fill="none" stroke="#07111f" stroke-width="12" stroke-linecap="round"/>
        <path d="M ${dimensions.width * 0.94} ${dimensions.height * 0.32} C ${dimensions.width * 0.89} ${dimensions.height * 0.23}, ${dimensions.width * 0.84} ${dimensions.height * 0.2}, ${dimensions.width * 0.81} ${dimensions.height * 0.19}" fill="none" stroke="#07111f" stroke-width="12" stroke-linecap="round"/>
      </g>
      <g filter="url(#lightShadow)">
        <path d="M ${dimensions.width * 0.72} ${dimensions.height * 0.5} L ${dimensions.width * 0.9} ${dimensions.height * 0.5} L ${dimensions.width * 0.86} ${dimensions.height * 0.72} L ${dimensions.width * 0.76} ${dimensions.height * 0.72} Z" fill="#ffd166"/>
        <path d="M ${dimensions.width * 0.77} ${dimensions.height * 0.72} L ${dimensions.width * 0.85} ${dimensions.height * 0.72} L ${dimensions.width * 0.87} ${dimensions.height * 0.8} L ${dimensions.width * 0.75} ${dimensions.height * 0.8} Z" fill="#f59e0b"/>
        <rect x="${dimensions.width * 0.715}" y="${dimensions.height * 0.79}" width="${dimensions.width * 0.19}" height="${dimensions.height * 0.055}" rx="18" fill="#07111f"/>
        <path d="M ${dimensions.width * 0.71} ${dimensions.height * 0.53} C ${dimensions.width * 0.66} ${dimensions.height * 0.53}, ${dimensions.width * 0.65} ${dimensions.height * 0.62}, ${dimensions.width * 0.72} ${dimensions.height * 0.64}" fill="none" stroke="#ffd166" stroke-width="16" stroke-linecap="round"/>
        <path d="M ${dimensions.width * 0.91} ${dimensions.height * 0.53} C ${dimensions.width * 0.96} ${dimensions.height * 0.53}, ${dimensions.width * 0.97} ${dimensions.height * 0.62}, ${dimensions.width * 0.9} ${dimensions.height * 0.64}" fill="none" stroke="#ffd166" stroke-width="16" stroke-linecap="round"/>
      </g>
      <path d="M 18 18 H ${dimensions.width - 18} V ${dimensions.height - 18} H 18 Z" fill="none" stroke="#fff" stroke-width="10" opacity="0.82"/>
    </svg>
  `;
}

function detectCategory(input) {
  const value = input.toLowerCase();

  if (/(money|cash|rich|business|stock|crypto|profit|income|sales|100k|\$)/.test(value)) {
    return { label: "MONEY", icon: "$" };
  }
  if (/(code|ai|app|react|next|software|tech|laptop|website|programming|developer)/.test(value)) {
    return { label: "TECH", icon: "</>" };
  }
  if (/(burger|food|cook|recipe|pizza|meal|restaurant|cake)/.test(value)) {
    return { label: "FOOD", icon: "YUM" };
  }
  if (/(game|gaming|battle|fortnite|minecraft|shadow|fight|rank)/.test(value)) {
    return { label: "GAMING", icon: "VS" };
  }
  if (/(world cup|football|soccer|fifa|stadium|trophy|goal|match|players|cricket|nba|nfl|sports)/.test(value)) {
    return { label: "SPORTS", icon: "GOAL" };
  }
  if (/(fitness|gym|workout|muscle|diet|weight|body)/.test(value)) {
    return { label: "FITNESS", icon: "GO" };
  }
  if (/(learn|tutorial|course|guide|how to|beginner|master)/.test(value)) {
    return { label: "TUTORIAL", icon: "101" };
  }

  return { label: "VIRAL", icon: "!" };
}

function createKeywordArt(category, dimensions, colors) {
  const x = dimensions.width * 0.7;
  const y = dimensions.height * 0.25;
  const panelWidth = dimensions.width * 0.23;
  const panelHeight = dimensions.height * 0.46;
  const icon = escapeXml(category.icon);

  const commonPanel = `
    <g filter="url(#shadow)">
      <rect x="${x - 22}" y="${y + 22}" width="${panelWidth}" height="${panelHeight}" rx="40" fill="#000" opacity="0.28"/>
      <rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" rx="40" fill="#ffffff"/>
      <rect x="${x + 18}" y="${y + 18}" width="${panelWidth - 36}" height="${panelHeight - 36}" rx="30" fill="${colors.accent}" opacity="0.18"/>
    </g>
  `;

  if (category.label === "MONEY") {
    return `
      ${commonPanel}
      <g filter="url(#softShadow)">
        <text x="${x + panelWidth * 0.25}" y="${y + panelHeight * 0.45}" fill="#16a34a" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="150" font-weight="900">$</text>
        <rect x="${x + panelWidth * 0.16}" y="${y + panelHeight * 0.56}" width="${panelWidth * 0.68}" height="86" rx="18" fill="#111827"/>
        <text x="${x + panelWidth * 0.22}" y="${y + panelHeight * 0.68}" fill="#fff" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="48" font-weight="900">100X</text>
      </g>
    `;
  }

  if (category.label === "TECH") {
    return `
      ${commonPanel}
      <g filter="url(#softShadow)">
        <rect x="${x + panelWidth * 0.16}" y="${y + panelHeight * 0.25}" width="${panelWidth * 0.68}" height="${panelHeight * 0.42}" rx="22" fill="#111827"/>
        <rect x="${x + panelWidth * 0.2}" y="${y + panelHeight * 0.3}" width="${panelWidth * 0.6}" height="${panelHeight * 0.28}" rx="10" fill="${colors.secondary}"/>
        <text x="${x + panelWidth * 0.24}" y="${y + panelHeight * 0.49}" fill="#fff" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="58" font-weight="900">${icon}</text>
        <rect x="${x + panelWidth * 0.34}" y="${y + panelHeight * 0.7}" width="${panelWidth * 0.32}" height="24" rx="12" fill="#111827"/>
      </g>
    `;
  }

  if (category.label === "GAMING") {
    return `
      ${commonPanel}
      <g filter="url(#softShadow)">
        <circle cx="${x + panelWidth * 0.5}" cy="${y + panelHeight * 0.35}" r="96" fill="#111827"/>
        <text x="${x + panelWidth * 0.26}" y="${y + panelHeight * 0.43}" fill="#fff" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="96" font-weight="900">VS</text>
        <path d="M ${x + panelWidth * 0.24} ${y + panelHeight * 0.62} L ${x + panelWidth * 0.76} ${y + panelHeight * 0.62} L ${x + panelWidth * 0.66} ${y + panelHeight * 0.78} L ${x + panelWidth * 0.34} ${y + panelHeight * 0.78} Z" fill="${colors.primary}"/>
      </g>
    `;
  }

  if (category.label === "FOOD") {
    return `
      ${commonPanel}
      <g filter="url(#softShadow)">
        <circle cx="${x + panelWidth * 0.5}" cy="${y + panelHeight * 0.45}" r="116" fill="#f59e0b"/>
        <path d="M ${x + panelWidth * 0.2} ${y + panelHeight * 0.44} Q ${x + panelWidth * 0.5} ${y + panelHeight * 0.2} ${x + panelWidth * 0.8} ${y + panelHeight * 0.44}" fill="#92400e"/>
        <rect x="${x + panelWidth * 0.22}" y="${y + panelHeight * 0.47}" width="${panelWidth * 0.56}" height="42" rx="20" fill="#22c55e"/>
        <rect x="${x + panelWidth * 0.2}" y="${y + panelHeight * 0.57}" width="${panelWidth * 0.6}" height="62" rx="28" fill="#f97316"/>
      </g>
    `;
  }

  if (category.label === "SPORTS") {
    return `
      ${commonPanel}
      <g filter="url(#softShadow)">
        <circle cx="${x + panelWidth * 0.5}" cy="${y + panelHeight * 0.36}" r="84" fill="#ffffff"/>
        <path d="M ${x + panelWidth * 0.5} ${y + panelHeight * 0.23} L ${x + panelWidth * 0.59} ${y + panelHeight * 0.33} L ${x + panelWidth * 0.55} ${y + panelHeight * 0.48} L ${x + panelWidth * 0.45} ${y + panelHeight * 0.48} L ${x + panelWidth * 0.41} ${y + panelHeight * 0.33} Z" fill="#111827"/>
        <path d="M ${x + panelWidth * 0.25} ${y + panelHeight * 0.36} C ${x + panelWidth * 0.34} ${y + panelHeight * 0.28}, ${x + panelWidth * 0.43} ${y + panelHeight * 0.24}, ${x + panelWidth * 0.5} ${y + panelHeight * 0.23}" fill="none" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
        <path d="M ${x + panelWidth * 0.75} ${y + panelHeight * 0.36} C ${x + panelWidth * 0.66} ${y + panelHeight * 0.28}, ${x + panelWidth * 0.57} ${y + panelHeight * 0.24}, ${x + panelWidth * 0.5} ${y + panelHeight * 0.23}" fill="none" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
        <path d="M ${x + panelWidth * 0.34} ${y + panelHeight * 0.64} L ${x + panelWidth * 0.66} ${y + panelHeight * 0.64} L ${x + panelWidth * 0.6} ${y + panelHeight * 0.82} L ${x + panelWidth * 0.4} ${y + panelHeight * 0.82} Z" fill="${colors.primary}"/>
        <rect x="${x + panelWidth * 0.25}" y="${y + panelHeight * 0.78}" width="${panelWidth * 0.5}" height="42" rx="18" fill="#111827"/>
      </g>
    `;
  }

  return `
    ${commonPanel}
    <g filter="url(#softShadow)">
      <circle cx="${x + panelWidth * 0.5}" cy="${y + panelHeight * 0.34}" r="92" fill="#ffe0bd"/>
      <circle cx="${x + panelWidth * 0.4}" cy="${y + panelHeight * 0.31}" r="12" fill="#111827"/>
      <circle cx="${x + panelWidth * 0.6}" cy="${y + panelHeight * 0.31}" r="12" fill="#111827"/>
      <path d="M ${x + panelWidth * 0.37} ${y + panelHeight * 0.41} Q ${x + panelWidth * 0.5} ${y + panelHeight * 0.52} ${x + panelWidth * 0.64} ${y + panelHeight * 0.41}" fill="none" stroke="#111827" stroke-width="16" stroke-linecap="round"/>
      <rect x="${x + panelWidth * 0.22}" y="${y + panelHeight * 0.58}" width="${panelWidth * 0.56}" height="${panelHeight * 0.24}" rx="42" fill="#111827"/>
      <text x="${x + panelWidth * 0.36}" y="${y + panelHeight * 0.74}" fill="${colors.accent}" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="64" font-weight="900">${icon}</text>
    </g>
  `;
}

function createTagline(title, details) {
  const source = `${title} ${details}`.toLowerCase();

  if (/(money|cash|rich|business|stock|crypto|profit|income|sales|100k|\$)/.test(source)) return "BIG RESULT";
  if (/(code|ai|app|react|next|software|tech|laptop|website|programming|developer)/.test(source)) return "BUILD FAST";
  if (/(burger|food|cook|recipe|pizza|meal|restaurant|cake)/.test(source)) return "LOOKS TASTY";
  if (/(game|gaming|battle|fortnite|minecraft|shadow|fight|rank)/.test(source)) return "EPIC MOMENT";
  if (/(world cup|football|soccer|fifa|stadium|trophy|goal|match|players|cricket|nba|nfl|sports)/.test(source)) return "MATCH DAY";
  if (/(learn|tutorial|course|guide|how to|beginner|master)/.test(source)) return "STEP BY STEP";

  return details || "CLICK WORTHY";
}

function getDimensions(aspectRatio) {
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  if (aspectRatio === "9:16") return { width: 1080, height: 1920 };
  return { width: 1280, height: 720 };
}

function splitTitle(title, aspectRatio, maxCharsOverride) {
  const maxChars = maxCharsOverride || (aspectRatio === "9:16" ? 10 : 14);
  const lines = [];
  let current = "";

  for (const word of title.split(" ")) {
    if (`${current} ${word}`.trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
    if (lines.length === 3) break;
  }

  if (current && lines.length < 3) lines.push(current);
  return lines.length ? lines : [title.slice(0, maxChars)];
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;
const configuredGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const geminiApiKey = configuredGeminiKey.includes("paste_your") ? "" : configuredGeminiKey;
const geminiModel = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

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
    createdAt: new Date().toISOString(),
  };

  if (mongoose.connection.readyState === 1) {
    const saved = await Thumbnail.create(thumbnail);
    response.status(201).json({ thumbnail: saved.toObject() });
    return;
  }

  response.status(201).json({ thumbnail });
});

async function generateThumbnailImage({ title, style, aspectRatio, colors, details, colorDescription }) {
  if (!geminiApiKey) {
    return {
      imageUrl: createSvgThumbnail({ title, style, aspectRatio, colors, details }),
      provider: "local-fallback",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const interaction = await ai.interactions.create({
      model: geminiModel,
      input: buildGeminiThumbnailPrompt({
        title,
        style,
        aspectRatio,
        details,
        colorDescription,
      }),
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: aspectRatio,
        image_size: "1K",
      },
    });

    if (!interaction.output_image?.data) {
      throw new Error("Gemini did not return an image");
    }

    return {
      imageUrl: `data:${interaction.output_image.mime_type || "image/png"};base64,${interaction.output_image.data}`,
      provider: geminiModel,
    };
  } catch (error) {
    console.error("Gemini generation failed, using local fallback:", error.message);
    return {
      imageUrl: createSvgThumbnail({ title, style, aspectRatio, colors, details }),
      provider: "local-fallback-after-gemini-error",
    };
  }
}

function buildGeminiThumbnailPrompt({ title, style, aspectRatio, details, colorDescription }) {
  return `
Create a high-converting YouTube thumbnail.

Video title text to include exactly and clearly: "${title}"
Aspect ratio: ${aspectRatio}
Visual style: ${style}
Color direction: ${colorDescription}
Extra user details: ${details || "Use a strong creator-focused thumbnail composition."}

Requirements:
- Make it look like a professional YouTube thumbnail, not a poster.
- Use bold readable text, dramatic lighting, high contrast, and a clear focal subject.
- Leave safe margins around all text.
- Include only short supporting text if needed.
- Do not add watermarks, fake UI controls, browser chrome, or unreadable tiny text.
- Make the image visually exciting and clickable.
`.trim();
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

function createSvgThumbnail({ title, style, aspectRatio, colors, details }) {
  const dimensions = getDimensions(aspectRatio);
  const [primary, secondary, accent] = colors;
  const safeTitle = escapeXml(title);
  const safeDetails = escapeXml(createTagline(title, details));
  const category = detectCategory(`${title} ${details}`);
  const words = splitTitle(safeTitle, aspectRatio);
  const keywordArt = createKeywordArt(category, dimensions, { primary, secondary, accent });
  const headline = words.map((line, index) => {
    const y = aspectRatio === "9:16" ? 360 + index * 116 : 258 + index * 98;
    const fontSize = aspectRatio === "9:16" ? 84 : 92;
    return `
      <text x="${dimensions.width * 0.065}" y="${y + 8}" fill="#000" opacity="0.55" font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="0">${line}</text>
      <text x="${dimensions.width * 0.06}" y="${y}" fill="#fff" stroke="#111827" stroke-width="10" paint-order="stroke" font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="0">${line}</text>
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
        <text x="${dimensions.width * 0.085}" y="${dimensions.height * 0.178}" fill="#111827" font-family="Arial Black, Arial, sans-serif" font-size="${aspectRatio === "9:16" ? 38 : 40}" font-weight="900">${escapeXml(category.label)}</text>
        ${headline.join("")}
        <rect x="${dimensions.width * 0.06}" y="${dimensions.height * 0.735}" width="${dimensions.width * 0.5}" height="${dimensions.height * 0.095}" rx="18" fill="#ffffff"/>
        <text x="${dimensions.width * 0.088}" y="${dimensions.height * 0.795}" fill="#111827" font-family="Arial Black, Arial, sans-serif" font-size="${aspectRatio === "9:16" ? 30 : 34}" font-weight="900">${safeDetails.slice(0, aspectRatio === "9:16" ? 26 : 38)}</text>
      </g>
      ${keywordArt}
      <rect x="18" y="18" width="${dimensions.width - 36}" height="${dimensions.height - 36}" rx="28" fill="none" stroke="#fff" stroke-width="10" opacity="0.82"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
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
  if (/(fitness|gym|workout|muscle|diet|weight|body)/.test(value)) {
    return { label: "FITNESS", icon: "GO" };
  }
  if (/(learn|tutorial|course|guide|how to|beginner|master)/.test(value)) {
    return { label: "TUTORIAL", icon: "101" };
  }

  return { label: "VIRAL", icon: "!" };
}

function createKeywordArt(category, dimensions, colors) {
  const x = dimensions.width * 0.66;
  const y = dimensions.height * 0.25;
  const panelWidth = dimensions.width * 0.27;
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
        <text x="${x + panelWidth * 0.25}" y="${y + panelHeight * 0.45}" fill="#16a34a" font-family="Arial Black, Impact, sans-serif" font-size="150" font-weight="900">$</text>
        <rect x="${x + panelWidth * 0.16}" y="${y + panelHeight * 0.56}" width="${panelWidth * 0.68}" height="86" rx="18" fill="#111827"/>
        <text x="${x + panelWidth * 0.22}" y="${y + panelHeight * 0.68}" fill="#fff" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900">100X</text>
      </g>
    `;
  }

  if (category.label === "TECH") {
    return `
      ${commonPanel}
      <g filter="url(#softShadow)">
        <rect x="${x + panelWidth * 0.16}" y="${y + panelHeight * 0.25}" width="${panelWidth * 0.68}" height="${panelHeight * 0.42}" rx="22" fill="#111827"/>
        <rect x="${x + panelWidth * 0.2}" y="${y + panelHeight * 0.3}" width="${panelWidth * 0.6}" height="${panelHeight * 0.28}" rx="10" fill="${colors.secondary}"/>
        <text x="${x + panelWidth * 0.24}" y="${y + panelHeight * 0.49}" fill="#fff" font-family="Arial Black, Arial, sans-serif" font-size="58" font-weight="900">${icon}</text>
        <rect x="${x + panelWidth * 0.34}" y="${y + panelHeight * 0.7}" width="${panelWidth * 0.32}" height="24" rx="12" fill="#111827"/>
      </g>
    `;
  }

  if (category.label === "GAMING") {
    return `
      ${commonPanel}
      <g filter="url(#softShadow)">
        <circle cx="${x + panelWidth * 0.5}" cy="${y + panelHeight * 0.35}" r="96" fill="#111827"/>
        <text x="${x + panelWidth * 0.26}" y="${y + panelHeight * 0.43}" fill="#fff" font-family="Arial Black, Impact, sans-serif" font-size="96" font-weight="900">VS</text>
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

  return `
    ${commonPanel}
    <g filter="url(#softShadow)">
      <circle cx="${x + panelWidth * 0.5}" cy="${y + panelHeight * 0.34}" r="92" fill="#ffe0bd"/>
      <circle cx="${x + panelWidth * 0.4}" cy="${y + panelHeight * 0.31}" r="12" fill="#111827"/>
      <circle cx="${x + panelWidth * 0.6}" cy="${y + panelHeight * 0.31}" r="12" fill="#111827"/>
      <path d="M ${x + panelWidth * 0.37} ${y + panelHeight * 0.41} Q ${x + panelWidth * 0.5} ${y + panelHeight * 0.52} ${x + panelWidth * 0.64} ${y + panelHeight * 0.41}" fill="none" stroke="#111827" stroke-width="16" stroke-linecap="round"/>
      <rect x="${x + panelWidth * 0.22}" y="${y + panelHeight * 0.58}" width="${panelWidth * 0.56}" height="${panelHeight * 0.24}" rx="42" fill="#111827"/>
      <text x="${x + panelWidth * 0.36}" y="${y + panelHeight * 0.74}" fill="${colors.accent}" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900">${icon}</text>
    </g>
  `;
}

function createTagline(title, details) {
  const source = `${title} ${details}`.toLowerCase();

  if (/(money|cash|rich|business|stock|crypto|profit|income|sales|100k|\$)/.test(source)) return "BIG RESULT";
  if (/(code|ai|app|react|next|software|tech|laptop|website|programming|developer)/.test(source)) return "BUILD FAST";
  if (/(burger|food|cook|recipe|pizza|meal|restaurant|cake)/.test(source)) return "LOOKS TASTY";
  if (/(game|gaming|battle|fortnite|minecraft|shadow|fight|rank)/.test(source)) return "EPIC MOMENT";
  if (/(learn|tutorial|course|guide|how to|beginner|master)/.test(source)) return "STEP BY STEP";

  return details || "CLICK WORTHY";
}

function getDimensions(aspectRatio) {
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  if (aspectRatio === "9:16") return { width: 1080, height: 1920 };
  return { width: 1280, height: 720 };
}

function splitTitle(title, aspectRatio) {
  const maxChars = aspectRatio === "9:16" ? 10 : 16;
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

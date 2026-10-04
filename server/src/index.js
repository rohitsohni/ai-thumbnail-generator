import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

const stylePrompts = {
  "Bold & Graphic":
    "eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition, professional style",
  "Tech/Futuristic":
    "futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, dramatic lighting, high-tech atmosphere",
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
  response.json({ ok: true, app: "AI Thumbnail Generator" });
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

async function generateThumbnailImage({ title, style, aspectRatio, details, colorDescription }) {
  try {
    const dimensions = getDimensions(aspectRatio);
    const prompt = buildPollinationsThumbnailPrompt({ title, style, details, colorDescription });
    const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
    url.searchParams.set("width", String(dimensions.width));
    url.searchParams.set("height", String(dimensions.height));
    // turbo is far less prone to inventing poster-style typography than flux.
    url.searchParams.set("model", "turbo");
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
    console.error("Pollinations generation failed:", error.message);
    throw error;
  }
}

function buildPollinationsThumbnailPrompt({ title, style, details, colorDescription }) {
  return [
    "textless background photo, absolutely no typography anywhere in frame",
    `scene evoking the theme: ${title}, depicted visually only, never spelled out as text`,
    "cinematic composition, high contrast, vibrant lighting, crisp focus, dramatic subject, viral creator thumbnail style",
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
    console.log(`Server running on http://localhost:${port}`);
  });
}

if (!process.env.VERCEL) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default app;

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

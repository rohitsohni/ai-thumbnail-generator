function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load generated image"));
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

/** Draws `title` as a crisp caption over the image, since free image models can't reliably render legible text themselves. */
export async function composeThumbnailWithTitle(imageUrl: string, title: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return imageUrl;

  ctx.drawImage(img, 0, 0);

  const maxWidth = canvas.width * 0.9;
  const maxLines = 3;
  let fontSize = Math.round(canvas.width / 14);
  let lines: string[] = [];

  while (fontSize >= 28) {
    ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
    lines = wrapLines(ctx, title.trim(), maxWidth);
    if (lines.length <= maxLines) break;
    fontSize -= 4;
  }
  lines = lines.slice(0, maxLines);

  const lineHeight = fontSize * 1.18;
  const bandHeight = lineHeight * lines.length + canvas.height * 0.06;
  const bandTop = canvas.height - bandHeight;

  const gradient = ctx.createLinearGradient(0, bandTop, 0, canvas.height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, bandTop, canvas.width, bandHeight);

  ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = fontSize * 0.14;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";

  const startY = canvas.height - canvas.height * 0.05 - (lines.length - 1) * lineHeight;
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillText(line, canvas.width / 2, y);
  });

  return canvas.toDataURL("image/jpeg", 0.92);
}

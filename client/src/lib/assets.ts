export const aspectRatios = ["16:9", "1:1", "9:16"] as const;
export type AspectRatio = (typeof aspectRatios)[number];

export const thumbnailStyles = [
  "Bold & Graphic",
  "Minimalist",
  "Photorealistic",
  "Illustrated",
  "Tech/Futuristic",
] as const;
export type ThumbnailStyle = (typeof thumbnailStyles)[number];

export interface ThumbnailRequest {
  title: string;
  colorSchemeId: string;
  aspectRatio: AspectRatio;
  style: ThumbnailStyle;
  additionalDetails?: string;
}

export interface Thumbnail {
  _id: string;
  userId: string;
  title: string;
  style: ThumbnailStyle;
  aspect_ratio: AspectRatio;
  color_scheme: string;
  text_overlay: boolean;
  image_url: string;
  prompt_used?: string;
  user_prompt?: string;
  provider?: string;
  createdAt: string;
}

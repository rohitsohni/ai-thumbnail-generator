import heroImg from "../assets/hero_img.png";
import thumb1 from "../assets/thumb_1.jpg";
import thumb2 from "../assets/thumb_2.jpg";
import thumb3 from "../assets/thumb_3.jpg";
import thumb4 from "../assets/thumb_4.jpg";
import thumb5 from "../assets/thumb_5.jpg";
import thumb6 from "../assets/thumb_6.jpg";
import thumb7 from "../assets/thumb_7.jpg";

export const heroImage = heroImg;

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

export const colorSchemes = [
  { id: "vibrant", name: "Vibrant", colors: ["#FF6B6B", "#4ECDC4", "#45B7D1"] },
  { id: "sunset", name: "Sunset", colors: ["#FF8C42", "#FF3C38", "#A23B72"] },
  { id: "ocean", name: "Ocean", colors: ["#0077B6", "#00B4D8", "#90E0EF"] },
  { id: "forest", name: "Forest", colors: ["#2D6A4F", "#40916C", "#95D5B2"] },
  { id: "purple", name: "Purple Dream", colors: ["#7B2CBF", "#9D4EDD", "#C77DFF"] },
  { id: "monochrome", name: "Monochrome", colors: ["#212529", "#495057", "#ADB5BD"] },
  { id: "neon", name: "Neon", colors: ["#FF00FF", "#00FFFF", "#FFFF00"] },
  { id: "pastel", name: "Pastel", colors: ["#FFB5A7", "#FCD5CE", "#F8EDEB"] },
] as const;

export type ColorScheme = (typeof colorSchemes)[number];

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
  isGenerating?: boolean;
  createdAt: string;
}

export const dummyThumbnails: Thumbnail[] = [
  {
    _id: "69451ff3c9ea67e4c930f6a6",
    userId: "6942b3bd2a93a220baa331b3",
    title: "Top smartwatch under 1499",
    style: "Bold & Graphic",
    aspect_ratio: "16:9",
    color_scheme: "vibrant",
    text_overlay: true,
    image_url: thumb1,
    prompt_used: "add multiple smartwatches",
    user_prompt: "add multiple smartwatches",
    createdAt: "2025-12-19T09:50:43.727Z",
  },
  {
    _id: "69451d5bc9ea67e4c930f698",
    userId: "6942b3bd2a93a220baa331b3",
    title: "Learn How to make 100k in 10 days",
    style: "Bold & Graphic",
    aspect_ratio: "16:9",
    color_scheme: "vibrant",
    text_overlay: true,
    image_url: thumb2,
    prompt_used: "add cash images graph and etc",
    user_prompt: "add cash images graph and etc",
    createdAt: "2025-12-19T09:39:39.971Z",
  },
  {
    _id: "6943fb409fa048268a04f105",
    userId: "6942b3bd2a93a220baa331b3",
    title: "Learn NextJS 16 with a Project",
    style: "Bold & Graphic",
    aspect_ratio: "16:9",
    color_scheme: "vibrant",
    text_overlay: true,
    image_url: thumb3,
    prompt_used: "add human with laptop",
    user_prompt: "add human with laptop",
    createdAt: "2025-12-18T13:01:52.205Z",
  },
  {
    _id: "6943e8c763d3d5ec3e4f5c8c",
    userId: "6942b3bd2a93a220baa331b3",
    title: "Learn how to use Photoshop",
    style: "Bold & Graphic",
    aspect_ratio: "16:9",
    color_scheme: "vibrant",
    text_overlay: true,
    image_url: thumb4,
    prompt_used: "",
    user_prompt: "",
    createdAt: "2025-12-18T11:43:03.281Z",
  },
  {
    _id: "6943e2220611d25b40e529b3",
    userId: "6942b3bd2a93a220baa331b3",
    title: "Make Burger in 30 min",
    style: "Photorealistic",
    aspect_ratio: "1:1",
    color_scheme: "vibrant",
    text_overlay: true,
    image_url: thumb5,
    createdAt: "2025-12-18T11:14:42.466Z",
  },
  {
    _id: "6943e04c0611d25b40e529ac",
    userId: "6942b3bd2a93a220baa331b3",
    title: "Learn Full Stack Development",
    style: "Bold & Graphic",
    aspect_ratio: "16:9",
    color_scheme: "vibrant",
    text_overlay: true,
    image_url: thumb6,
    createdAt: "2025-12-18T11:06:52.555Z",
  },
  {
    _id: "6943d68d5b9fed7040154a0f",
    userId: "6942b3bd2a93a220baa331b3",
    title: "Learn ReactJS in 2 hours",
    style: "Bold & Graphic",
    aspect_ratio: "16:9",
    color_scheme: "ocean",
    text_overlay: true,
    image_url: thumb7,
    createdAt: "2025-12-18T10:25:17.135Z",
  },
];

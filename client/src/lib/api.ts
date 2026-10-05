import axios from "axios";
import type { Thumbnail, ThumbnailRequest } from "./assets";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

export async function createThumbnail(payload: ThumbnailRequest) {
  const { data } = await api.post<{ thumbnail: Thumbnail }>("/thumbnails", payload);
  return data.thumbnail;
}

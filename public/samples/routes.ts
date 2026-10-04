export const places = [
  "internal",
  "photos",
  "videos",
  "music",
  "documents",
  "archives",
  "drive",
  "device",
] as const;

export type Place = (typeof places)[number];

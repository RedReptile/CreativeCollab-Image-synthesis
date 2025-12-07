const DEFAULT_BASE_URL =
  process.env.REACT_APP_UPSCALE_API_URL || "http://localhost:8000";

export const UPSCALE_ENDPOINT = `${DEFAULT_BASE_URL}/upscale`;

export const RESOLUTION_SCALE_MAP = {
  "480p": 1,
  "720p": 2,
  "1080p": 4,
  "4k": 4,
};

export const getScaleForResolution = (resolution) =>
  RESOLUTION_SCALE_MAP[resolution] ?? null;


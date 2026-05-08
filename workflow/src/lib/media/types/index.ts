// ─── Media pipeline types ─────────────────────────────────────────────────────

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: "image" | "video" | "audio" | "file";
  source: "transloadit" | "local";
  /** Node that produced/owns this asset */
  sourceNodeId?: string;
  createdAt: number;
}

export interface UploadResult {
  asset: MediaAsset;
  transloaditAssemblyId?: string;
}

export interface UploadError {
  code:
    | "invalid_mime"
    | "file_too_large"
    | "upload_failed"
    | "network_error"
    | "corrupt_file";
  message: string;
}

export interface CropParams {
  x: number; // percentage 0–100
  y: number;
  width: number;
  height: number;
}

export interface CropResult {
  outputUrl: string;
  mimeType: string;
  size?: number;
}

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  type UploadError,
} from "../types";

export function validateImageFile(file: File): UploadError | null {
  if (
    !ACCEPTED_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    )
  ) {
    return {
      code: "invalid_mime",
      message: `File type "${file.type}" is not supported. Accepted: jpg, jpeg, png, webp, gif`,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      code: "file_too_large",
      message: `File is ${mb}MB. Maximum allowed size is 20MB`,
    };
  }

  return null;
}

export function validateImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

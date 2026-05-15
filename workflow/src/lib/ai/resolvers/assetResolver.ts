import type { AIImageInput } from "../types";

export async function resolveImageInput(
  value: unknown,
): Promise<AIImageInput | null> {
  if (!value || typeof value !== "string") return null;

  // Already a data URL
  if (value.startsWith("data:")) {
    const match = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { url: value, mimeType: match[1] };
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {


    try {
      const res = await fetch(value);
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return {
        url: `data:${contentType};base64,${base64}`,
        mimeType: contentType,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolves multiple image values into normalized AIImageInput array.
 * Filters out nulls and deduplicates by URL.
 */
export async function resolveImageInputs(
  values: unknown[],
): Promise<AIImageInput[]> {
  const resolved = await Promise.all(values.map(resolveImageInput));
  const seen = new Set<string>();
  return resolved.filter((img): img is AIImageInput => {
    if (!img) return false;
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
}

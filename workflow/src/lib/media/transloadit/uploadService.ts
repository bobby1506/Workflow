import { nanoid } from "nanoid";
import type { MediaAsset, UploadResult } from "../types";

// ─── Transloadit assembly params ─────────────────────────────────────────────

interface TransloaditParams {
  auth: { key: string; expires: string };
  steps: Record<string, unknown>;
}

/**
 * Build Transloadit assembly params for a simple image store (no processing).
 * The image is stored as-is and a CDN URL is returned.
 */
function buildStoreParams(): TransloaditParams {
  const key = process.env.TRANSLOADIT_KEY ?? "";
  // Expires 1 hour from now
  const expires = new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "+00:00");

  return {
    auth: { key, expires },
    steps: {
      ":original": {
        robot: "/upload/handle",
      },
      store: {
        use: ":original",
        robot: "/s3/store",
        // Falls back to Transloadit's own CDN if no S3 configured
        result: true,
      },
    },
  };
}

/**
 * Upload a file to Transloadit and return a CDN-backed MediaAsset.
 * Falls back to local data URL if Transloadit is not configured.
 */
export async function uploadToTransloadit(
  file: File,
  sourceNodeId?: string,
): Promise<UploadResult> {
  const hasTransloadit =
    process.env.TRANSLOADIT_KEY && process.env.TRANSLOADIT_SECRET;

  if (!hasTransloadit) {
    // Fallback: local data URL (dev mode)
    return uploadLocalFallback(file, sourceNodeId);
  }

  try {
    const params = buildStoreParams();
    const formData = new FormData();
    formData.append("params", JSON.stringify(params));
    formData.append("file", file);

    const res = await fetch("https://api2.transloadit.com/assemblies", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Transloadit upload failed: ${res.status}`);
    }

    const assembly = await res.json();

    // Poll for assembly completion
    const cdnUrl = await pollAssembly(assembly.assembly_ssl_url);

    const asset: MediaAsset = {
      id: nanoid(),
      url: cdnUrl,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      type: "image",
      source: "transloadit",
      sourceNodeId,
      createdAt: Date.now(),
    };

    return { asset, transloaditAssemblyId: assembly.assembly_id };
  } catch {
    // Fallback to local on error
    return uploadLocalFallback(file, sourceNodeId);
  }
}

async function pollAssembly(assemblyUrl: string): Promise<string> {
  const maxAttempts = 30;
  const pollInterval = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const res = await fetch(assemblyUrl);
    const data = await res.json();

    if (data.ok === "ASSEMBLY_COMPLETED") {
      // Get the first result URL
      const results = data.results;
      const firstKey = Object.keys(results)[0];
      if (firstKey && results[firstKey]?.[0]?.ssl_url) {
        return results[firstKey][0].ssl_url as string;
      }
    }

    if (data.error) {
      throw new Error(`Assembly error: ${data.error}`);
    }
  }

  throw new Error("Assembly timed out");
}

async function uploadLocalFallback(
  file: File,
  sourceNodeId?: string,
): Promise<UploadResult> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const asset: MediaAsset = {
    id: nanoid(),
    url: dataUrl,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    type: "image",
    source: "local",
    sourceNodeId,
    createdAt: Date.now(),
  };

  return { asset };
}

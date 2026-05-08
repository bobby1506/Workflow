"use client";

import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import type { UploadedAsset, HandleDataType } from "../types";
import { validateImageFile } from "@/lib/media/utils/validation";

export type UploadState = "idle" | "uploading" | "done" | "error";

interface UseFileUploadOptions {
  accept?: string;
  assetType:
    | HandleDataType.IMAGE
    | HandleDataType.VIDEO
    | HandleDataType.AUDIO
    | HandleDataType.FILE;
  onUpload: (asset: UploadedAsset) => void;
  sourceNodeId?: string;
}

interface UseFileUploadReturn {
  uploadState: UploadState;
  progress: number;
  error: string | null;
  triggerUpload: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function useFileUpload({
  accept,
  assetType,
  onUpload,
  sourceNodeId,
}: UseFileUploadOptions): UseFileUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = {
    current: null,
  } as React.RefObject<HTMLInputElement | null>;

  const triggerUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept ?? "image/jpeg,image/png,image/webp,image/gif";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (assetType === "image") {
        const validationError = validateImageFile(file);
        if (validationError) {
          setError(validationError.message);
          setUploadState("error");
          return;
        }
      }

      setUploadState("uploading");
      setProgress(10);
      setError(null);

      try {
        const url = await uploadViaTransloadit(file, (p) => setProgress(p));
        const asset: UploadedAsset = {
          id: nanoid(),
          url,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          type: file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : "image",
          source: "transloadit",
        };
        onUpload(asset);
        setUploadState("done");
        setProgress(100);
      } catch (err) {
        // Fallback to local FileReader if Transloadit fails
        await uploadLocal(file, onUpload, (p) => setProgress(p));
        setUploadState("done");
        setProgress(100);
      }
    };

    input.click();
  }, [accept, assetType, onUpload]);

  return { uploadState, progress, error, triggerUpload, inputRef };
}

// ─── Transloadit upload via signed params from our API ────────────────────────

async function uploadViaTransloadit(
  file: File,
  onProgress: (p: number) => void,
): Promise<string> {
  // Get signed params from our server
  const sigRes = await fetch("/api/upload/signature", { method: "POST" });
  if (!sigRes.ok) throw new Error("Failed to get upload signature");

  const sigData = await sigRes.json();

  // If Transloadit is not configured server-side, fall back to local
  if (!sigData.configured) {
    throw new Error("Transloadit not configured");
  }

  onProgress(20);

  // Upload to Transloadit
  const formData = new FormData();
  formData.append("params", sigData.params);
  formData.append("signature", sigData.signature);
  formData.append("file", file);

  const uploadRes = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Transloadit upload failed: ${uploadRes.status}`);
  }

  const assembly = await uploadRes.json();

  if (assembly.error) {
    throw new Error(`Transloadit error: ${assembly.error}`);
  }

  onProgress(50);

  // Poll for assembly completion
  const assemblyUrl = assembly.assembly_ssl_url as string;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    onProgress(Math.min(50 + i * 0.8, 95));

    const pollRes = await fetch(assemblyUrl);
    if (!pollRes.ok) continue;

    const data = await pollRes.json();

    if (data.ok === "ASSEMBLY_COMPLETED") {
      // Try all result keys to find a URL
      const results = data.results as Record<
        string,
        Array<{ ssl_url?: string; url?: string }>
      >;
      for (const key of Object.keys(results)) {
        const first = results[key]?.[0];
        if (first?.ssl_url) return first.ssl_url;
        if (first?.url) return first.url;
      }
      // No result URL — check uploads array
      const uploads = data.uploads as Array<{ ssl_url?: string; url?: string }>;
      if (uploads?.[0]?.ssl_url) return uploads[0].ssl_url;
      if (uploads?.[0]?.url) return uploads[0].url;
      throw new Error("Assembly completed but no URL found in results");
    }

    if (data.error) {
      throw new Error(`Assembly failed: ${data.error}`);
    }
  }

  throw new Error("Transloadit assembly timed out");
}

// ─── Local upload fallback (FileReader → data URL) ────────────────────────────

async function uploadLocal(
  file: File,
  onUpload: (asset: UploadedAsset) => void,
  onProgress: (p: number) => void,
): Promise<void> {
  let p = 0;
  const interval = setInterval(() => {
    p = Math.min(p + 25, 90);
    onProgress(p);
  }, 80);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  clearInterval(interval);

  const asset: UploadedAsset = {
    id: nanoid(),
    url: dataUrl,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    type: file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : "image",
    source: "local",
  };

  onUpload(asset);
}

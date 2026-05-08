"use client";

import { useFileUpload } from "../hooks/useFileUpload";
import { HandleDataType } from "../types";
import type { UploadedAsset } from "../types";

interface ImageUploadAreaProps {
  asset: UploadedAsset | null | undefined;
  isConnected: boolean;
  onUpload: (asset: UploadedAsset) => void;
  onRemove: () => void;
  accept?: string;
  label?: string;
  sourceNodeId?: string;
}

export function ImageUploadArea({
  asset,
  isConnected,
  onUpload,
  onRemove,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  label = "Upload Image",
  sourceNodeId,
}: ImageUploadAreaProps) {
  const { uploadState, progress, error, triggerUpload } = useFileUpload({
    accept,
    assetType: HandleDataType.IMAGE,
    onUpload,
    sourceNodeId,
  });

  if (isConnected) {
    return (
      <div className="px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs text-gray-400 italic">
        Connected
      </div>
    );
  }

  if (uploadState === "error" && error) {
    return (
      <div className="px-2 py-1.5 rounded border border-red-200 bg-red-50">
        <p className="text-[11px] text-red-600 mb-1">{error}</p>
        <button
          onClick={triggerUpload}
          className="text-[11px] text-indigo-500 hover:text-indigo-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (uploadState === "uploading") {
    return (
      <div className="px-2 py-1.5 rounded border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 mb-1">
          <svg
            className="w-3 h-3 animate-spin text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span className="text-[11px] text-gray-500">
            Uploading… {progress > 0 && progress < 100 ? `${progress}%` : ""}
          </span>
        </div>
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (asset) {
    return (
      <div className="relative group rounded border border-gray-200 overflow-hidden bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.filename}
          className="w-full max-h-24 object-contain"
        />
        {/* Source badge */}
        {asset.source === "transloadit" && (
          <div className="absolute top-1 right-1">
            <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700">
              CDN
            </span>
          </div>
        )}
        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={triggerUpload}
            className="px-2 py-1 text-[10px] font-medium text-white bg-white/20 hover:bg-white/30 rounded transition-colors"
            title="Replace image"
          >
            Replace
          </button>
          <button
            onClick={onRemove}
            className="px-2 py-1 text-[10px] font-medium text-white bg-red-500/70 hover:bg-red-500 rounded transition-colors"
            title="Remove image"
          >
            Remove
          </button>
        </div>
        <p className="px-2 py-0.5 text-[10px] text-gray-400 truncate border-t border-gray-100">
          {asset.filename}
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={triggerUpload}
      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-gray-200 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-colors cursor-pointer"
    >
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      {label}
    </button>
  );
}

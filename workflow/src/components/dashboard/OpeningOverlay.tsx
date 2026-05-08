"use client";

interface OpeningOverlayProps {
  visible: boolean;
}

export function OpeningOverlay({ visible }: OpeningOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
      {/* Simple spinner matching the screenshot */}
      <svg
        className="w-10 h-10 animate-spin text-gray-800"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          className="opacity-90"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          d="M12 2 a10 10 0 0 1 10 10"
        />
      </svg>
      <p className="text-sm text-gray-600 font-medium">Opening workflow...</p>
    </div>
  );
}

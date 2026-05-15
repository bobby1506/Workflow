"use client";

interface CreatingOverlayProps {
  visible: boolean;
}

export function CreatingOverlay({ visible }: CreatingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, rgba(216,180,254,0.45) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(186,230,253,0.45) 0%, transparent 60%), #fff",
      }}
    >
      {/* Concentric circles icon */}
      <div className="relative w-28 h-28 mb-8">
        {[44, 36, 28, 20, 10].map((r, i) => (
          <svg
            key={i}
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            fill="none"
          >
            <circle
              cx="50"
              cy="50"
              r={r}
              stroke="rgba(100,80,100,0.35)"
              strokeWidth="1.5"
            />
          </svg>
        ))}
        {/* Center dot */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          fill="none"
        >
          <circle cx="50" cy="50" r="4" fill="rgba(80,60,80,0.7)" />
        </svg>
        {/* Rotating half circle at bottom */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin"
          viewBox="0 0 100 100"
          fill="none"
          style={{ animationDuration: "1.5s" }}
        >
          <path
            d="M 6 50 A 44 44 0 0 1 94 50"
            stroke="#000000"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p className="text-xl font-bold text-gray-800 text-center max-w-xs leading-snug">
        Warning: May cause sudden bursts of productivity ⚡
      </p>

      {/* Animated dots */}
      <div className="flex items-center gap-2 mt-6">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-gray-400"
            style={{
              animation: `nextflow-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes nextflow-dot-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

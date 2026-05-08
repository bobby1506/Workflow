"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowActions } from "./WorkflowActions";
import { OpeningOverlay } from "./OpeningOverlay";

interface WorkflowCardProps {
  id: string;
  name: string;
  updatedAt: Date;
  lastRunAt?: Date | null;
  isTemplate?: boolean;
  isRunning?: boolean;
  onClone?: () => void;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function WorkflowCard({
  id,
  name,
  updatedAt,
  lastRunAt,
  isTemplate = false,
  isRunning = false,
  onClone,
}: WorkflowCardProps) {
  const [cloning, setCloning] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showNameTooltip, setShowNameTooltip] = useState(false);
  const router = useRouter();

  async function handleTemplateClick(e: React.MouseEvent) {
    if (!isTemplate || !onClone) return;
    e.preventDefault();
    setCloning(true);
    await onClone();
    setCloning(false);
  }

  function handleCardClick(e: React.MouseEvent) {
    e.preventDefault();
    setOpening(true);
    router.push(`/workflow/${id}`);
  }

  const thumbnail = (
    <div className="relative w-full h-40 bg-gray-100 overflow-hidden rounded-t-2xl">
      <Image
        src="/hello.png"
        alt={name}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
      {/* Live running badge — top left */}
      {isRunning && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-green-500 text-white text-[10px] font-semibold rounded-full shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Running
        </div>
      )}
      {/* Clone overlay */}
      {cloning && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
          <svg
            className="w-5 h-5 animate-spin text-gray-600"
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
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="px-3 py-2.5 bg-white rounded-b-2xl">
      <div
        className="relative"
        onMouseEnter={() => setShowNameTooltip(true)}
        onMouseLeave={() => setShowNameTooltip(false)}
      >
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        {showNameTooltip && (
          <div className="absolute bottom-full left-0 mb-1 z-50 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap pointer-events-none shadow-lg">
            {name}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-0.5">
        Edited {lastRunAt ? timeAgo(lastRunAt) : timeAgo(updatedAt)}
      </p>
    </div>
  );

  if (isTemplate) {
    return (
      <div
        onClick={handleTemplateClick}
        className="group relative w-full rounded-2xl hover:shadow-md transition-all duration-150 cursor-pointer bg-white overflow-hidden"
      >
        {thumbnail}
        {footer}
      </div>
    );
  }

  return (
    <>
      <OpeningOverlay visible={opening} />

      <div className="group relative w-full">
        {/* Three-dot menu — top right, visible on hover */}
        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <WorkflowActions
            workflowId={id}
            workflowName={name}
            onOpen={() => {
              setOpening(true);
              router.push(`/workflow/${id}`);
            }}
          />
        </div>

        <div
          onClick={handleCardClick}
          className={`rounded-2xl hover:shadow-md transition-all duration-150 cursor-pointer bg-white overflow-hidden ${
            isRunning ? "ring-2 ring-green-400 ring-offset-1" : ""
          }`}
        >
          {thumbnail}
          {footer}
        </div>
      </div>
    </>
  );
}

# Design Document: Trigger.dev Realtime Refactor

## Overview

Replace custom polling/SSE/eventBus layer with Trigger.dev Realtime APIs. The workflow execution logic remains unchanged; only the listening/realtime layer is replaced.

## Architecture

### Current (To Remove)

- Frontend polling via `setInterval` in `useWorkflowExecution`
- Custom SSE endpoint at `/api/workflows/[id]/events`
- In-memory `eventBus` singleton
- HTTP callbacks from tasks to `/api/internal/node-event` and `/api/internal/run-complete`

### New (To Implement)

- **Frontend**: `useRealtimeRun` + `useRealtimeStream` from `@trigger.dev/react-hooks`
- **Tasks**: `metadata.set()` for progress, `streams.define()` for AI streaming
- **Auth**: Server-side `auth.createPublicToken()` scoped per run
- **Provider**: `TriggerProvider` wrapping workflow editor

## Key Components

### 1. Authentication (Requirement 4)

- Route Handler: `POST /api/workflows/[id]/run` returns `triggerRunId` + `publicToken`
- Token scoped to specific run ID via `auth.createPublicToken()`
- User ownership verified before token generation

### 2. TriggerProvider Setup (Requirement 5)

- Wrap workflow editor in `TriggerProvider` from `@trigger.dev/react-hooks`
- Pass `publicToken` as `accessToken` prop
- Client Component compatible with Next.js App Router

### 3. Metadata-Driven Progress (Requirement 6)

- `workflowOrchestratorTask` uses `metadata.set()` for:
  - `nodes.<nodeId>.status` (queued/running/success/failed/skipped)
  - `nodes.<nodeId>.output` (on success)
  - `nodes.<nodeId>.error` (on failure)
  - `nodes.<nodeId>.startedAt` (Unix ms)
  - `nodes.<nodeId>.durationMs` (elapsed)
  - `runStatus` (running/success/failed/partial)
  - `completedNodeCount` / `totalNodeCount` (progress)

### 4. AI Streaming (Requirement 7)

- `geminiTask` uses `streams.define("gemini-response-<nodeId>")`
- Writes token chunks to stream
- `workflowOrchestratorTask` sets `nodes.<nodeId>.streamName` in metadata

### 5. Frontend Hooks (Requirements 8-10)

- `useWorkflowRunRealtime`: Subscribes to run, maps metadata → ExecutionStore
- `useWorkflowStream`: Subscribes to Gemini stream, accumulates tokens
- `useExecutionProgress`: Derives progress % from metadata counts

### 6. Database Persistence (Requirement 13)

- Tasks write directly to DB using `db` client
- No more HTTP callbacks for persistence
- `NodeRun` and `Run` records updated inside tasks

## File Changes Summary

### Delete

- `src/lib/realtime/events/eventBus.ts`
- `src/lib/realtime/emitters/executionEmitter.ts`
- `src/lib/realtime/hooks/useExecutionEvents.ts`
- `src/app/api/workflows/[id]/events/route.ts`
- `src/app/api/internal/node-event/route.ts`
- `src/app/api/internal/run-complete/route.ts`

### Create

- `src/features/workflow-editor/hooks/useWorkflowRunRealtime.ts`
- `src/features/workflow-editor/hooks/useWorkflowStream.ts`
- `src/features/workflow-editor/hooks/useExecutionProgress.ts`
- `src/app/api/workflows/[id]/token/route.ts` (public token generation)

### Modify

- `src/trigger/types.ts` (remove `callbackBaseUrl`)
- `src/trigger/tasks/workflowOrchestratorTask.ts` (add metadata, remove callbacks)
- `src/trigger/tasks/geminiTask.ts` (add streams, remove callbacks)
- `src/trigger/tasks/cropImageTask.ts` (remove callbacks)
- `src/features/workflow-editor/hooks/useWorkflowExecution.ts` (remove polling, add realtime)
- `src/features/workflow-editor/store/workflowEditorStore.ts` (add triggerRunId, publicToken)
- `src/components/ClientProviders.tsx` (add TriggerProvider)
- `src/app/api/workflows/[id]/run/route.ts` (return triggerRunId + publicToken)

## Data Flow

### Run Execution

1. Frontend calls `POST /api/workflows/[id]/run`
2. Backend creates DB Run, generates `publicToken`, returns both
3. Frontend stores `triggerRunId` + `publicToken` in store
4. Frontend wraps in `TriggerProvider` with token
5. Frontend calls `useWorkflowRunRealtime(triggerRunId, publicToken)`
6. Hook subscribes to run via `useRealtimeRun`
7. Task updates metadata → Hook receives updates → ExecutionStore updated → UI re-renders

### AI Streaming

1. `geminiTask` defines stream `gemini-response-<nodeId>`
2. `workflowOrchestratorTask` sets `nodes.<nodeId>.streamName` in metadata
3. Frontend's `useWorkflowStream` hook subscribes to stream
4. Tokens arrive → Hook accumulates → ExecutionStore updated → Canvas updates

## Compatibility

- Next.js App Router: All hooks are Client Components
- Vercel: No custom WebSocket server or Redis required
- Trigger.dev v4: Uses official `@trigger.dev/react-hooks` v4.4.6

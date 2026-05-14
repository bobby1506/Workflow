# Requirements Document

## Introduction

This feature replaces the existing custom realtime listening layer in the Next.js + Trigger.dev v4 application with the official Trigger.dev Realtime APIs. The application currently uses a combination of polling (`setInterval`, recursive fetch loops), a custom SSE system (`eventBus.ts`, `/api/workflows/[id]/events`, `EventSource`), and internal HTTP callbacks (`/api/internal/node-event`, `/api/internal/run-complete`) to propagate execution state from Trigger.dev tasks to the frontend.

The workflow execution logic itself (DAG compilation, task dispatch, node orchestration) is correct and must not change. Only the listening/realtime layer is being replaced. After the refactor, the frontend subscribes directly to Trigger.dev run state via `@trigger.dev/react-hooks`, and tasks emit progress and streaming data through Trigger.dev's native metadata and streams APIs.

## Glossary

- **Trigger.dev Realtime**: The official Trigger.dev APIs for subscribing to run state from the frontend, including `useRealtimeRun`, `useRealtimeStream`, `metadata`, and `streams.define()`.
- **useRealtimeRun**: A React hook from `@trigger.dev/react-hooks` that subscribes to a Trigger.dev run's status, metadata, and output in real time.
- **useRealtimeStream**: A React hook from `@trigger.dev/react-hooks` that subscribes to a named stream defined inside a Trigger.dev task.
- **streams.define()**: A Trigger.dev SDK function used inside tasks to create a named stream that can be consumed by `useRealtimeStream` on the frontend.
- **metadata**: The Trigger.dev SDK's `metadata` object, used inside tasks to attach structured key-value data to a run that is observable in real time via `useRealtimeRun`.
- **TriggerProvider**: The React context provider from `@trigger.dev/react-hooks` that must wrap all components using Trigger.dev hooks.
- **PublicAccessToken**: A short-lived, scoped token generated server-side via the Trigger.dev SDK that grants the frontend read-only access to a specific run's realtime data.
- **Orchestrator**: The `workflowOrchestratorTask` Trigger.dev task that coordinates node execution.
- **NodeTask**: A Trigger.dev task that executes a single workflow node (e.g., `geminiTask`, `cropImageTask`).
- **ExecutionStore**: The Zustand store (`executionStore.ts`) that holds in-memory node execution state for the UI.
- **WorkflowEditorStore**: The Zustand store (`workflowEditorStore.ts`) that holds the canvas state.
- **RunRecord**: A database record in the `Run` table representing a single workflow execution.
- **NodeRun**: A database record in the `NodeRun` table representing a single node's execution within a run.
- **SSE**: Server-Sent Events — the custom push mechanism being removed.
- **eventBus**: The in-memory pub/sub singleton (`eventBus.ts`) being removed.
- **callbackBaseUrl**: The base URL currently passed to tasks for HTTP callbacks — being removed.
- **NodeMetadata**: A structured object stored in Trigger.dev run metadata representing the execution state of all nodes in a workflow run.
- **GeminiStream**: The named Trigger.dev stream used by `geminiTask` to emit AI token chunks.

---

## Requirements

### Requirement 1: Remove All Polling Infrastructure

**User Story:** As a developer, I want all polling mechanisms removed from the codebase, so that the frontend never makes periodic status-check requests.

#### Acceptance Criteria

1. THE Codebase SHALL contain zero calls to `setInterval` used for run or node status polling after the refactor is complete.
2. THE Codebase SHALL contain zero recursive `fetch` calls that re-invoke themselves on a timer to check run or node status.
3. THE Codebase SHALL contain zero uses of `refetchInterval` or equivalent periodic re-fetch patterns for run status.
4. WHEN the `useWorkflowExecution` hook dispatches a Trigger.dev run, THE Hook SHALL NOT start a polling loop to check run completion.
5. THE `startPolling` function in `useWorkflowExecution.ts` SHALL be removed entirely.

---

### Requirement 2: Remove All Custom SSE and EventBus Infrastructure

**User Story:** As a developer, I want all custom SSE endpoints, the eventBus singleton, and EventSource usage removed, so that no custom realtime transport layer exists in the codebase.

#### Acceptance Criteria

1. THE File `src/lib/realtime/events/eventBus.ts` SHALL be deleted.
2. THE File `src/lib/realtime/emitters/executionEmitter.ts` SHALL be deleted.
3. THE File `src/lib/realtime/hooks/useExecutionEvents.ts` SHALL be deleted.
4. THE Route `src/app/api/workflows/[id]/events/route.ts` (the SSE endpoint) SHALL be deleted.
5. THE Route `src/app/api/internal/node-event/route.ts` SHALL be deleted.
6. THE Route `src/app/api/internal/run-complete/route.ts` SHALL be deleted.
7. THE Codebase SHALL contain zero imports of `EventSource` after the refactor.
8. THE Codebase SHALL contain zero imports from `src/lib/realtime/events/eventBus` after the refactor.
9. THE Codebase SHALL contain zero imports from `src/lib/realtime/emitters/executionEmitter` after the refactor.
10. THE `useRealtimeExecution` hook SHALL be replaced with a new implementation that uses only Trigger.dev Realtime hooks.

---

### Requirement 3: Remove HTTP Callback Pattern from Tasks

**User Story:** As a developer, I want Trigger.dev tasks to stop making HTTP callbacks to internal API routes, so that task-to-frontend communication goes exclusively through Trigger.dev's native channels.

#### Acceptance Criteria

1. THE `workflowOrchestratorTask` SHALL NOT call `fetch` to `/api/internal/node-event` or `/api/internal/run-complete`.
2. THE `geminiTask` SHALL NOT call `fetch` to `/api/internal/node-event`.
3. THE `cropImageTask` SHALL NOT call `fetch` to `/api/internal/node-event`.
4. THE `callbackBaseUrl` field SHALL be removed from `WorkflowTaskPayload` and `NodeTaskPayload` in `src/trigger/types.ts`.
5. THE `notify` helper object in `workflowOrchestratorTask.ts` SHALL be removed.
6. THE `notifyNodeStatus` and `notifyStreamChunk` helper functions in `geminiTask.ts` SHALL be removed.
7. THE `notifyNodeStatus` helper function in `cropImageTask.ts` SHALL be removed.
8. WHEN the `/api/workflows/[id]/run` route creates a run and dispatches a task, THE Route SHALL NOT include `callbackBaseUrl` in the task payload.

---

### Requirement 4: Implement Trigger.dev Authentication for Frontend Subscriptions

**User Story:** As a developer, I want the frontend to obtain a scoped Trigger.dev access token when a run starts, so that it can securely subscribe to that run's realtime data without exposing the secret key.

#### Acceptance Criteria

1. THE System SHALL provide a Route Handler that generates a `PublicAccessToken` scoped to a specific Trigger.dev run ID.
2. WHEN a workflow run is created via `POST /api/workflows/[id]/run`, THE Response SHALL include the Trigger.dev run ID (the `triggerRunId` returned by `tasks.trigger()`).
3. THE `PublicAccessToken` SHALL be generated using the Trigger.dev SDK's `auth.createPublicToken()` function with a scope limited to the specific run ID.
4. THE `PublicAccessToken` SHALL be generated server-side only and SHALL NOT expose the `TRIGGER_SECRET_KEY` to the client.
5. WHEN a `PublicAccessToken` is requested for a run and the requesting user does not own the associated `RunRecord`, THE System SHALL return a 403 error and SHALL NOT issue a token.
6. THE `PublicAccessToken` SHALL have an expiry of no more than 1 hour.
7. IF `auth.createPublicToken()` throws an error, THE Route Handler SHALL return a 500 error response and SHALL NOT return a partial or empty token to the client.

---

### Requirement 5: Implement TriggerProvider in the Application

**User Story:** As a developer, I want the `TriggerProvider` from `@trigger.dev/react-hooks` configured in the application, so that all Trigger.dev realtime hooks have the required context.

#### Acceptance Criteria

1. THE `TriggerProvider` from `@trigger.dev/react-hooks` SHALL be added to the React component tree at a level that wraps all workflow editor components.
2. THE `TriggerProvider` SHALL be configured as a Client Component compatible with Next.js App Router.
3. THE `TriggerProvider` SHALL receive the `PublicAccessToken` as its `accessToken` prop when a run is active and a token is available.
4. WHEN no run is active, THE `TriggerProvider` SHALL render its children without a token (unauthenticated state is acceptable for non-run views).
5. THE `TriggerProvider` SHALL be placed inside the existing `ClientProviders` component or as a sibling wrapper, without removing the `ClerkProvider`.
6. WHEN a run is active but token retrieval fails, THE `TriggerProvider` SHALL still render its children without blocking, passing no `accessToken` prop.

---

### Requirement 6: Implement Metadata-Driven Node Progress in Tasks

**User Story:** As a developer, I want Trigger.dev tasks to emit node execution state through the `metadata` API, so that the frontend can observe per-node status without any custom transport.

#### Acceptance Criteria

1. THE `workflowOrchestratorTask` SHALL use `metadata.set()` to record the status of each node as it transitions through `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, and `SKIPPED` states.
2. THE Metadata key for node statuses SHALL follow the structure `nodes.<nodeId>.status` with values matching the `RuntimeNodeStatus` type used by the `ExecutionStore`.
3. WHEN a node transitions to `SUCCESS`, THE `workflowOrchestratorTask` SHALL set `nodes.<nodeId>.output` in metadata with the node's output object.
4. WHEN a node transitions to `FAILED`, THE `workflowOrchestratorTask` SHALL set `nodes.<nodeId>.error` in metadata with the error message string.
5. THE `workflowOrchestratorTask` SHALL set a top-level `runStatus` metadata key with values `running`, `success`, `failed`, or `partial` to reflect overall run state.
6. THE `workflowOrchestratorTask` SHALL set a `completedNodeCount` and `totalNodeCount` metadata key to support progress bar rendering on the frontend; WHEN `completedNodeCount` would exceed `totalNodeCount` due to a counting error, THE Orchestrator SHALL cap `completedNodeCount` at `totalNodeCount`.
7. WHEN a `NodeTask` (geminiTask, cropImageTask) begins execution, THE `workflowOrchestratorTask` SHALL set `nodes.<nodeId>.startedAt` in metadata with the current Unix timestamp in milliseconds.
8. WHEN a `NodeTask` completes, THE `workflowOrchestratorTask` SHALL set `nodes.<nodeId>.durationMs` in metadata with the elapsed duration.

---

### Requirement 7: Implement AI Token Streaming via streams.define()

**User Story:** As a developer, I want the Gemini task to stream AI tokens through Trigger.dev's native streams API, so that the frontend receives partial responses in real time without any custom SSE or callback infrastructure.

#### Acceptance Criteria

1. THE `geminiTask` SHALL define a named stream using `streams.define()` with the stream name `gemini-response`.
2. WHEN the Gemini API emits a token chunk, THE `geminiTask` SHALL write the chunk to the `gemini-response` stream.
3. THE Stream name SHALL be scoped per node execution to avoid collisions when multiple Gemini nodes run concurrently; the stream name SHALL follow the pattern `gemini-response-<nodeId>`.
4. WHEN the Gemini API call naturally completes, THE `geminiTask` SHALL close the `gemini-response-<nodeId>` stream. WHEN an error occurs during streaming, THE `geminiTask` SHALL also close the stream before propagating the error.
5. THE `geminiTask` SHALL NOT call any HTTP endpoint to notify the frontend of streaming chunks.
6. WHEN a Gemini node begins execution, THE `workflowOrchestratorTask` SHALL set `nodes.<nodeId>.streamName` in metadata to the stream name before the first chunk is written, so the frontend can subscribe before streaming begins. IF the metadata update fails, THE `workflowOrchestratorTask` SHALL abort the Gemini node execution.

---

### Requirement 8: Implement useWorkflowRunRealtime Hook

**User Story:** As a developer, I want a reusable `useWorkflowRunRealtime` hook that subscribes to a Trigger.dev run and maps its metadata to the `ExecutionStore`, so that all node status updates flow through a single, clean interface.

#### Acceptance Criteria

1. THE `useWorkflowRunRealtime` hook SHALL accept a `triggerRunId` parameter (the Trigger.dev run ID) and a `publicToken` parameter.
2. WHEN `triggerRunId` and `publicToken` are provided, THE Hook SHALL call `useRealtimeRun` from `@trigger.dev/react-hooks` to subscribe to the run.
3. WHEN the run metadata contains `nodes.<nodeId>.status`, THE Hook SHALL call the appropriate `ExecutionStore` action to update the node's status in the UI.
4. WHEN the run metadata contains `nodes.<nodeId>.output`, THE Hook SHALL call `updateNodeData` on the `WorkflowEditorStore` to update the canvas node's displayed output.
5. WHEN the run metadata `runStatus` transitions to `success`, `failed`, or `partial`, THE Hook SHALL call `ExecutionStore.finishRun()` with the mapped status and `WorkflowEditorStore.setIsRunning(false, null)`. THE Hook SHALL only trigger these cleanup actions on actual status transitions, not when first observing a run already in a terminal state.
6. WHEN the Trigger.dev run status becomes `COMPLETED`, `FAILED`, or `CANCELED`, THE Hook SHALL treat this as a terminal state and ignore all subsequent metadata updates.
7. THE Hook SHALL be located at `src/features/workflow-editor/hooks/useWorkflowRunRealtime.ts`.
8. IF `triggerRunId` is `null` or `undefined`, THE Hook SHALL return early without subscribing.
9. IF `publicToken` is `null`, `undefined`, or an empty string, THE Hook SHALL return early without subscribing.

---

### Requirement 9: Implement useWorkflowStream Hook for AI Streaming

**User Story:** As a developer, I want a reusable `useWorkflowStream` hook that subscribes to a Gemini node's token stream and updates the canvas in real time, so that partial AI responses appear as they are generated.

#### Acceptance Criteria

1. THE `useWorkflowStream` hook SHALL accept a `triggerRunId`, `nodeId`, `streamName`, and `publicToken` parameter.
2. WHEN all parameters are provided, THE Hook SHALL call `useRealtimeStream` from `@trigger.dev/react-hooks` to subscribe to the named stream.
3. WHILE actively subscribed to a stream, WHEN a new token chunk arrives, THE Hook SHALL call `ExecutionStore.updateStreamingText(nodeId, accumulatedText)` with the full accumulated text so far.
4. WHILE actively subscribed to a stream, WHEN a new token chunk arrives, THE Hook SHALL call `WorkflowEditorStore.updateNodeData(nodeId, { response: accumulatedText })` to update the canvas node's response field.
5. WHEN the stream closes and the node status in `ExecutionStore.nodeStatuses` is not already `success`, THE Hook SHALL call `ExecutionStore.setNodeStatus(nodeId, "success")`. WHEN the stream closes and the node is already marked `success`, THE Hook SHALL preserve the existing status without any additional processing.
6. THE Hook SHALL be located at `src/features/workflow-editor/hooks/useWorkflowStream.ts`.
7. IF any of `triggerRunId`, `nodeId`, `streamName`, or `publicToken` is `null` or `undefined`, THE Hook SHALL return early without subscribing.
8. IF the stream subscription fails due to a network or authentication error, THE Hook SHALL log the error and call `ExecutionStore.recordNodeFailure(nodeId, errorMessage, 0)`.

---

### Requirement 10: Implement useExecutionProgress Hook

**User Story:** As a developer, I want a `useExecutionProgress` hook that derives progress bar data from run metadata, so that the UI can display accurate completion percentages without polling.

#### Acceptance Criteria

1. THE `useExecutionProgress` hook SHALL accept a `triggerRunId` and `publicToken` parameter.
2. IF `triggerRunId` or `publicToken` is `null` or `undefined`, THE Hook SHALL return `{ completedNodeCount: 0, totalNodeCount: 0, percentage: 0 }` without subscribing.
3. THE Hook SHALL call `useRealtimeRun` from `@trigger.dev/react-hooks` to subscribe to the run and read `completedNodeCount` and `totalNodeCount` from run metadata.
4. THE Hook SHALL return a `progress` object containing `completedNodeCount` (defaulting to `0` when absent in metadata), `totalNodeCount` (defaulting to `0` when absent in metadata), and a derived `percentage` value between 0 and 100.
5. IF `totalNodeCount` is greater than 0 and `completedNodeCount` is present in run metadata, THE Hook SHALL compute `percentage` as `Math.round((completedNodeCount / totalNodeCount) * 100)` using floating-point division that preserves fractional precision before rounding.
6. IF `totalNodeCount` is 0 or undefined in metadata, THE Hook SHALL return `percentage` as 0 to avoid division by zero.
7. THE Hook SHALL be located at `src/features/workflow-editor/hooks/useExecutionProgress.ts`.

---

### Requirement 11: Update useWorkflowExecution to Use Trigger.dev Realtime

**User Story:** As a developer, I want the `useWorkflowExecution` hook to store the Trigger.dev run ID and public token after dispatching a run, so that the realtime hooks can subscribe to the correct run.

#### Acceptance Criteria

1. WHEN `POST /api/workflows/[id]/run` returns successfully, THE `useWorkflowExecution` hook SHALL store the returned `triggerRunId` and `publicToken` in component or store state and pass them to `useWorkflowRunRealtime` regardless of the `distributed` flag value.
2. THE `useWorkflowExecution` hook SHALL NOT start any polling loop after receiving the `triggerRunId`.
3. THE `useWorkflowExecution` hook SHALL pass the `triggerRunId` and `publicToken` to `useWorkflowRunRealtime` to begin the realtime subscription.
4. WHEN the `distributed` flag in the run response is `false` (local dev mode), THE Hook SHALL fall back to the existing frontend mock orchestration path. IF the mock orchestration system fails to activate, THE Hook SHALL allow execution to proceed without a feedback mechanism and log the failure for developer inspection.
5. THE `WorkflowEditorStore` or a dedicated run state store SHALL expose `triggerRunId` and `publicToken` fields so that child hooks and components can access them without prop drilling.

---

### Requirement 12: Update Run API Route to Return Trigger.dev Run ID and Token

**User Story:** As a developer, I want the `POST /api/workflows/[id]/run` route to return the Trigger.dev run ID and a scoped public token, so that the frontend can immediately begin a realtime subscription.

#### Acceptance Criteria

1. WHEN `tasks.trigger("workflow-orchestrate", payload)` succeeds, THE Route SHALL capture the returned run handle and extract the Trigger.dev run ID from it.
2. THE Route SHALL generate a `PublicAccessToken` scoped to the Trigger.dev run ID using `auth.createPublicToken()`.
3. THE Route Response SHALL include `triggerRunId` (string) and `publicToken` (string) fields in addition to the existing `runId` and `distributed` fields.
4. IF `tasks.trigger()` fails, THE Route SHALL return an error response and SHALL NOT return a partial token.
5. THE Route SHALL NOT include `callbackBaseUrl` in the task payload dispatched to Trigger.dev.

---

### Requirement 13: Preserve Database Persistence for Node and Run Records

**User Story:** As a developer, I want node execution results and run completion status to continue being persisted to the database, so that run history and audit trails are not lost after removing the callback routes.

#### Acceptance Criteria

1. THE `workflowOrchestratorTask` SHALL continue to create and update `NodeRun` records in the database for each node execution.
2. THE `workflowOrchestratorTask` SHALL continue to update the `Run` record's `status` and `finishedAt` fields upon completion.
3. WHEN a node completes with `SUCCESS`, THE `workflowOrchestratorTask` SHALL persist the node's output to the `NodeRun.output` field. IF output persistence fails, THE Orchestrator SHALL log the error and continue workflow execution without failing the workflow.
4. WHEN a node completes with `FAILED`, THE `workflowOrchestratorTask` SHALL persist the error message to the `NodeRun.error` field and SHALL leave the `NodeRun.output` field empty or null.
5. THE Database persistence logic SHALL be performed directly inside the Trigger.dev tasks using the `db` client, replacing the previous HTTP callback approach.
6. THE `workflowOrchestratorTask` SHALL import and use the `db` client from `@/lib/db` for all database operations.

---

### Requirement 14: Next.js App Router and Vercel Compatibility

**User Story:** As a developer, I want the Trigger.dev Realtime integration to be compatible with Next.js App Router conventions and Vercel deployment, so that the application deploys and runs correctly in production.

#### Acceptance Criteria

1. ALL new hooks using `useRealtimeRun` and `useRealtimeStream` SHALL be Client Components (files with `"use client"` directive or hooks used only within Client Components).
2. THE `PublicAccessToken` generation SHALL occur in a Server Component, Server Action, or Route Handler — never in a Client Component.
3. THE `TriggerProvider` SHALL be a Client Component that receives the `publicToken` as a prop from a parent Server Component or via a Server Action.
4. THE System SHALL NOT use any Node.js-only APIs (e.g., `EventEmitter`, in-memory global state) in code paths that run on Vercel Edge Runtime.
5. WHEN deployed to Vercel, THE System SHALL function correctly without requiring any custom WebSocket server or Redis instance for realtime delivery.
6. THE `@trigger.dev/react-hooks` package SHALL be used at its installed version (`^4.4.6`) without introducing version conflicts with `@trigger.dev/sdk` (`4.4.6`).

---

### Requirement 15: Zero Legacy Realtime Artifacts After Refactor

**User Story:** As a developer, I want a clean codebase with no remnants of the old realtime system, so that future developers are not confused by dead code.

#### Acceptance Criteria

1. THE `src/lib/realtime/` directory SHALL contain only Trigger.dev-based types and utilities after the refactor; all SSE/eventBus files SHALL be deleted.
2. THE Codebase SHALL contain zero references to `executionEmitter` after the refactor.
3. THE Codebase SHALL contain zero references to `subscribe` or `emit` from `eventBus` after the refactor.
4. THE Codebase SHALL contain zero references to `INTERNAL_API_SECRET` in task files after the refactor (the env var may remain for other uses but SHALL NOT be used in Trigger.dev tasks).
5. THE `WorkflowTaskPayload` type SHALL NOT contain a `callbackBaseUrl` field after the refactor.
6. THE `NodeTaskPayload` type SHALL NOT contain a `callbackBaseUrl` field after the refactor.
7. THE `src/lib/realtime/` directory SHALL be removed only if it becomes empty after all refactor steps are complete. THE directory is expected to retain Trigger.dev-based types and utilities per criterion 1, so removal is not required if those files exist.

# Task List: Trigger.dev Realtime Refactor

## Task 1: Remove Polling Infrastructure

**Status**: not_started
**Depends on**: (none)

Remove all polling mechanisms from the codebase:

- Delete `startPolling` function and `pollIntervalRef` from `useWorkflowExecution.ts`
- Remove all `setInterval` calls used for status polling
- Verify zero polling calls remain in codebase

**Acceptance**: Codebase contains zero `setInterval` calls for polling after completion.

---

## Task 2: Remove Custom SSE and EventBus Infrastructure

**Status**: not_started
**Depends on**: Task 1

Delete all custom realtime transport files:

- Delete `src/lib/realtime/events/eventBus.ts`
- Delete `src/lib/realtime/emitters/executionEmitter.ts`
- Delete `src/lib/realtime/hooks/useExecutionEvents.ts`
- Delete `src/app/api/workflows/[id]/events/route.ts`
- Remove all imports of these files from codebase
- Verify zero `EventSource` usage remains

**Acceptance**: All SSE/eventBus files deleted, zero imports remain.

---

## Task 3: Remove HTTP Callback Pattern from Tasks

**Status**: not_started
**Depends on**: Task 2

Remove callback infrastructure from Trigger.dev tasks:

- Remove `callbackBaseUrl` field from `WorkflowTaskPayload` and `NodeTaskPayload` in `src/trigger/types.ts`
- Remove `notify` helper object from `workflowOrchestratorTask.ts`
- Remove `notifyNodeStatus` and `notifyStreamChunk` from `geminiTask.ts`
- Remove `notifyNodeStatus` from `cropImageTask.ts`
- Remove callback URL construction from `src/app/api/workflows/[id]/run/route.ts`
- Delete `src/app/api/internal/node-event/route.ts`
- Delete `src/app/api/internal/run-complete/route.ts`

**Acceptance**: No `fetch` calls to internal callback routes remain in tasks.

---

## Task 4: Implement Trigger.dev Authentication for Frontend Subscriptions

**Status**: not_started
**Depends on**: Task 3

Create server-side token generation:

- Create `src/app/api/workflows/[id]/token/route.ts` Route Handler
- Implement `auth.createPublicToken()` scoped to run ID
- Verify user ownership before issuing token
- Return 403 if user doesn't own run
- Handle `auth.createPublicToken()` errors with 500 response
- Token expiry: max 1 hour

**Acceptance**: Route returns `publicToken` scoped to run, user ownership verified.

---

## Task 5: Implement TriggerProvider in Application

**Status**: not_started
**Depends on**: Task 4

Set up Trigger.dev context provider:

- Update `src/components/ClientProviders.tsx` to import `TriggerProvider` from `@trigger.dev/react-hooks`
- Wrap children in `TriggerProvider` as Client Component
- Accept `accessToken` prop (initially null)
- Render children without blocking when token unavailable
- Keep `ClerkProvider` alongside

**Acceptance**: `TriggerProvider` wraps workflow editor, accepts token prop.

---

## Task 6: Implement Metadata-Driven Node Progress in Tasks

**Status**: not_started
**Depends on**: Task 3

Add metadata updates to `workflowOrchestratorTask`:

- Initialize `completedNodeCount = 0`, `totalNodeCount = executionNodeIds.length`
- Set `runStatus = "running"` at start
- For each node transition, call `metadata.set()`:
  - `nodes.<nodeId>.status` (queued/running/success/failed/skipped)
  - `nodes.<nodeId>.output` (on success)
  - `nodes.<nodeId>.error` (on failure)
  - `nodes.<nodeId>.startedAt` (Unix ms when node starts)
  - `nodes.<nodeId>.durationMs` (elapsed when node completes)
- Increment `completedNodeCount` when node completes (success/failed/skipped)
- Cap `completedNodeCount` at `totalNodeCount`
- Set `runStatus` to final status (success/failed/partial) at end
- Write DB records directly using `db` client

**Acceptance**: Metadata contains per-node status, output, error, timing, and progress counters.

---

## Task 7: Implement AI Token Streaming via streams.define()

**Status**: not_started
**Depends on**: Task 6

Add streaming to `geminiTask`:

- Define stream `gemini-response-<nodeId>` using `streams.define()`
- Write token chunks to stream as Gemini API emits them
- Close stream on completion or error
- Remove all HTTP callback calls for streaming
- Handle stream init failures by aborting task

**Acceptance**: Gemini tokens streamed via Trigger.dev streams, no HTTP callbacks.

---

## Task 8: Implement useWorkflowRunRealtime Hook

**Status**: not_started
**Depends on**: Task 6

Create `src/features/workflow-editor/hooks/useWorkflowRunRealtime.ts`:

- Accept `triggerRunId` and `publicToken` parameters
- Return early if either is null/undefined/empty
- Call `useRealtimeRun` from `@trigger.dev/react-hooks`
- Subscribe to run metadata
- Map metadata changes to ExecutionStore:
  - `nodes.<nodeId>.status` → `setNodeStatus()`
  - `nodes.<nodeId>.output` → `updateNodeData()`
  - `runStatus` transitions → `finishRun()` + `setIsRunning(false)`
- Ignore updates after run reaches terminal state (COMPLETED/FAILED/CANCELED)
- Only trigger cleanup on actual transitions, not on initial observation

**Acceptance**: Hook maps metadata to ExecutionStore, UI updates in real time.

---

## Task 9: Implement useWorkflowStream Hook for AI Streaming

**Status**: not_started
**Depends on**: Task 7

Create `src/features/workflow-editor/hooks/useWorkflowStream.ts`:

- Accept `triggerRunId`, `nodeId`, `streamName`, `publicToken` parameters
- Return early if any parameter is null/undefined
- Call `useRealtimeStream` from `@trigger.dev/react-hooks`
- Accumulate token chunks into full text
- Update ExecutionStore and canvas on each chunk
- On stream close, set node status to success if not already
- On error, log and call `recordNodeFailure(nodeId, error, 0)`

**Acceptance**: Gemini tokens appear in real time on canvas as they stream.

---

## Task 10: Implement useExecutionProgress Hook

**Status**: not_started
**Depends on**: Task 6

Create `src/features/workflow-editor/hooks/useExecutionProgress.ts`:

- Accept `triggerRunId` and `publicToken` parameters
- Return `{ completedNodeCount: 0, totalNodeCount: 0, percentage: 0 }` if params missing
- Call `useRealtimeRun` to subscribe to run metadata
- Read `completedNodeCount` and `totalNodeCount` from metadata
- Compute `percentage = Math.round((completedNodeCount / totalNodeCount) * 100)`
- Return 0% if `totalNodeCount` is 0

**Acceptance**: Progress bar displays accurate completion percentage.

---

## Task 11: Update useWorkflowExecution to Use Trigger.dev Realtime

**Status**: not_started
**Depends on**: Task 8, Task 9

Refactor `src/features/workflow-editor/hooks/useWorkflowExecution.ts`:

- Remove `startPolling` function entirely
- Remove `pollIntervalRef`
- After `POST /api/workflows/[id]/run` succeeds, extract `triggerRunId` and `publicToken`
- Store both in `WorkflowEditorStore` (add fields if needed)
- Call `useWorkflowRunRealtime(triggerRunId, publicToken)` to begin subscription
- Pass both to `useWorkflowStream` for Gemini nodes
- Keep frontend mock orchestration for `distributed=false` (dev mode)
- Remove all polling logic

**Acceptance**: No polling, realtime subscription begins immediately after run creation.

---

## Task 12: Update Run API Route to Return Trigger.dev Run ID and Token

**Status**: not_started
**Depends on**: Task 4

Modify `src/app/api/workflows/[id]/run/route.ts`:

- After `tasks.trigger("workflow-orchestrate", payload)` succeeds, extract run ID
- Call token generation route to get `publicToken`
- Return response with `triggerRunId` and `publicToken` fields
- Remove `callbackBaseUrl` from task payload
- Handle token generation failures with 500 error

**Acceptance**: Run API returns `triggerRunId` and `publicToken` to frontend.

---

## Task 13: Preserve Database Persistence for Node and Run Records

**Status**: not_started
**Depends on**: Task 6

Ensure DB persistence in tasks:

- `workflowOrchestratorTask` creates/updates `NodeRun` records using `db` client
- Persist node output on SUCCESS
- Persist error message on FAILED
- Leave output null on FAILED
- Update `Run` record status and `finishedAt` at completion
- Log errors but don't fail workflow if persistence fails

**Acceptance**: Run history and node results persisted to database.

---

## Task 14: Update WorkflowEditorStore to Expose Trigger.dev Run State

**Status**: not_started
**Depends on**: Task 11

Modify `src/features/workflow-editor/store/workflowEditorStore.ts`:

- Add `triggerRunId: string | null` field
- Add `publicToken: string | null` field
- Add actions to set both fields
- Expose fields for child hooks to access without prop drilling

**Acceptance**: Store exposes `triggerRunId` and `publicToken` for realtime hooks.

---

## Task 15: Clean Up Legacy Realtime Artifacts

**Status**: not_started
**Depends on**: Task 2, Task 3

Final cleanup:

- Verify zero references to `executionEmitter` in codebase
- Verify zero references to `eventBus` subscribe/emit
- Verify zero `INTERNAL_API_SECRET` usage in task files
- Remove `src/lib/realtime/` directory if empty
- Verify all imports of deleted files are removed

**Acceptance**: Codebase contains zero legacy realtime artifacts.

---

## Summary

**Total Tasks**: 15
**Dependencies**: Linear chain (each task depends on previous)
**Estimated Effort**: 8-12 hours
**Key Milestones**:

- Tasks 1-3: Remove old infrastructure
- Tasks 4-5: Set up new auth + provider
- Tasks 6-7: Implement task-side metadata + streaming
- Tasks 8-10: Implement frontend hooks
- Tasks 11-15: Integration + cleanup

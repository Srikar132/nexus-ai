# Message Flow Architecture

## ✅ FIXED: Single Source of Truth Pattern

### Previous Issues ❌
1. **Duplicate messages**: Zustand created messages with `crypto.randomUUID()`, backend saved with DB IDs → deduplication failed
2. **Lost messages on refresh**: SSE messages only lived in Zustand `liveMessages` → gone on page reload
3. **Optimistic messages never cleared**: Client ID ≠ DB ID → stayed in UI forever
4. **Complex merging logic**: Trying to merge TanStack Query + Zustand arrays caused race conditions

### New Architecture ✅

```
┌──────────────────────────────────────────────────────────────┐
│                    SINGLE SOURCE OF TRUTH                    │
│                  TanStack Query (DB messages)                │
│                                                              │
│  - All persisted messages (user + assistant)                │
│  - Optimistic updates via setQueryData()                    │
│  - Invalidated/refetched when SSE sends "done"              │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ Refetch on SSE "done"
                              │
┌──────────────────────────────────────────────────────────────┐
│              EPHEMERAL DISPLAY STATE (Zustand)               │
│                                                              │
│  - streamingText  → Live text chunks (cleared on agent_done) │
│  - stage          → Current workflow stage                   │
│  - activePlan     → Plan artifact from conductor             │
│  - isStreaming    → Loading indicator state                  │
│  - activeRole     → Which agent is speaking                  │
└──────────────────────────────────────────────────────────────┘
```

## Flow Diagram

### 1️⃣ User Sends Message

```
UI: sendAction({ action: "request_plan", content: "..." })
  ↓
TanStack Mutation:
  onMutate: Create optimistic message with temp-{timestamp} ID
            Add to TanStack Query cache immediately (UI shows instantly)
  ↓
POST /api/v1/projects/{id}/messages
  ↓
Backend: Saves to DB, returns { user_message_id: "uuid-from-db" }
  ↓
TanStack Mutation:
  onSuccess: Replace temp-{timestamp} with real DB uuid in cache
```

**Result**: User sees their message instantly, ID gets swapped when backend responds.

---

### 2️⃣ Backend Streams SSE Events

```
SSE: { type: "agent_start", role: "conductor" }
  ↓
Zustand: activeRole = "conductor"
  ↓
UI: Shows "Conductor is typing..." indicator

────────────────────────────────────────────────────

SSE: { type: "text_chunk", chunk: "Let me analyze..." }
  ↓
Zustand: streamingText += chunk
  ↓
UI: Shows live streaming text in a separate bubble

────────────────────────────────────────────────────

SSE: { type: "agent_done" }
  ↓
Zustand: Clear streamingText, activeRole = null
  ↓
Backend: Saves the complete streamed text as a Message in DB

────────────────────────────────────────────────────

SSE: { type: "artifact", artifact_type: "plan", content: {...} }
  ↓
Zustand: activePlan = content, stage = "plan_review"
  ↓
Backend: Saves plan artifact as Message in DB

────────────────────────────────────────────────────

SSE: { type: "done" }
  ↓
useWorkflow: queryClient.invalidateQueries(messages)
  ↓
TanStack Query: Refetch GET /api/v1/projects/{id}/messages
  ↓
Backend: Returns all saved messages (including streamed text + artifacts)
  ↓
UI: Shows complete message history from DB
```

**Result**: Streaming text is ephemeral display, DB is persisted truth.

---

## Key Principles

### 1. **TanStack Query = Source of Truth**
- ALL messages come from `GET /messages` endpoint
- Optimistic updates use `setQueryData()` with temp IDs
- When backend responds, temp ID → real DB ID
- On SSE `done` → invalidate → refetch → get complete history

### 2. **Zustand = Display-Only State**
- `streamingText` → Live chunks (cleared after agent_done)
- `stage` → Current workflow phase
- `activePlan` → Plan being reviewed
- **Never** accumulates messages (that's TanStack Query's job)

### 3. **Backend Persists Everything**
- User messages saved immediately on POST
- Streamed text saved when agent finishes
- Artifacts saved when published
- SSE events are just **notifications**, not the data itself

### 4. **No Client-Generated Message IDs in Final State**
- Temp IDs (`temp-${Date.now()}`) only live during optimistic update
- Always replaced with DB-generated UUID from backend
- Ensures deduplication works correctly

---

## UI Implementation

### Display Messages
```tsx
const { messages, streamingText, isStreaming, activeRole } = useWorkflow(projectId);

return (
  <div>
    {/* Persisted messages from DB */}
    {messages.map(msg => (
      <MessageBubble key={msg.id} message={msg} />
    ))}
    
    {/* Live streaming text (ephemeral) */}
    {isStreaming && streamingText && (
      <StreamingBubble role={activeRole} text={streamingText} />
    )}
  </div>
);
```

### Send Message
```tsx
const { sendAction } = useWorkflow(projectId);

// User message appears instantly (optimistic)
// Backend saves it → ID gets swapped
sendAction({ action: "request_plan", content: "Build a todo app" });
```

---

## Benefits

✅ **No duplicate messages**: DB ID is always used  
✅ **Survives page refresh**: Everything from DB  
✅ **Instant UI updates**: Optimistic + streaming  
✅ **Simple deduplication**: No complex merging logic  
✅ **Clear separation**: TanStack Query (data) vs Zustand (UI state)  

---

## Debugging Checklist

If messages don't appear:
1. Check DevTools → Network → `GET /messages` → messages array
2. Check TanStack Query cache: `workflowKeys.messages(projectId)`
3. Check if SSE sent `done` event (triggers refetch)

If duplicates appear:
1. Verify optimistic message has `temp-{timestamp}` ID
2. Verify `onSuccess` replaces temp ID with `response.user_message_id`
3. Check backend isn't creating duplicate DB entries

If streaming doesn't clear:
1. Verify SSE sends `agent_done` event
2. Check Zustand state: `streamingText` should be ""
3. Verify backend saves streamed content as Message before sending `done`

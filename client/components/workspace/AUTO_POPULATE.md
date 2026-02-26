# Auto-Populate Chat Input Feature

## Overview
When a user creates a new project from the getting-started page, their initial prompt is automatically populated in the project's chat input and optionally auto-sent.

## Flow

### 1. Project Creation (prompt-input.tsx)
```tsx
// User types prompt in getting-started page
const prompt = "Build me a SaaS dashboard...";

// On project creation, store prompt in localStorage
localStorage.setItem(
  `project-${project.id}-initial-prompt`,
  JSON.stringify({ 
    prompt, 
    autoSend: true, 
    timestamp: Date.now() 
  })
);

// Navigate to project page
router.push(`/project/${project.id}`);
```

### 2. Auto-Populate on Project Page (workspace-prompt-input.tsx)
```tsx
// On mount, check localStorage for initial prompt
useEffect(() => {
  if (!projectId) return;

  const storageKey = `project-${projectId}-initial-prompt`;
  const stored = localStorage.getItem(storageKey);
  
  if (stored) {
    const { prompt, autoSend, timestamp } = JSON.parse(stored);
    
    // Only use recent data (within 5 minutes)
    const isRecent = Date.now() - timestamp < 5 * 60 * 1000;
    
    if (isRecent && prompt) {
      // Populate input
      setValue(prompt);
      
      // Auto-send if flag is set
      if (autoSend && onSubmit) {
        setTimeout(() => {
          onSubmit(prompt, []);
        }, 500);
      }
    }
    
    // Clear after reading (one-time use)
    localStorage.removeItem(storageKey);
  }
}, [projectId, onSubmit]);
```

## Why Component-Level vs Hook-Level?

### ❌ Using Refs in Hook (Not Recommended)
```tsx
// In use-workflow.ts - NOT the best approach
const inputRef = useRef<HTMLTextAreaElement>(null);

// Would require:
// 1. Passing ref down through multiple components
// 2. Tight coupling between hook and UI
// 3. Direct DOM manipulation
```

### ✅ Component-Level State (Recommended)
```tsx
// In workspace-prompt-input.tsx - BETTER approach
const [value, setValue] = useState("");

useEffect(() => {
  // Just set state - React handles the rest
  setValue(prompt);
}, []);

// Benefits:
// 1. Clean React state management
// 2. Component owns its own logic
// 3. No ref drilling
// 4. Testable and predictable
```

## Key Features

1. **Automatic Population**: Prompt appears in input on page load
2. **Auto-Send Option**: Optionally sends message automatically after 500ms delay
3. **Stale Data Prevention**: Only uses prompts stored within last 5 minutes
4. **One-Time Use**: localStorage is cleared after reading (prevents repeated population)
5. **Graceful Degradation**: Works even if localStorage is empty or corrupt

## Props Flow

```
workspace-client.tsx
  ↓ passes projectId
workspace-chat.tsx
  ↓ passes projectId
workspace-prompt-input.tsx
  → reads localStorage["project-{projectId}-initial-prompt"]
  → auto-populates & optionally auto-sends
```

## Testing

1. **Create Project**: Type prompt in getting-started page → click "Build now"
2. **Verify Storage**: Check localStorage for `project-{id}-initial-prompt` key
3. **Navigate**: Redirected to `/project/{id}`
4. **Auto-Populate**: Prompt appears in chat input
5. **Auto-Send**: Message is sent automatically after 500ms
6. **Cleanup**: localStorage key is removed after use

## Error Handling

- Invalid JSON in localStorage → Caught and logged, feature gracefully fails
- Missing projectId → Effect doesn't run
- Stale data (>5 min) → Ignored
- No prompt in storage → Normal empty input behavior

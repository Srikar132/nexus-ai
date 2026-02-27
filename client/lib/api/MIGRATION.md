# API Refactoring Guide

## 🎯 What Changed?

### Before (Messy):
- ❌ `fetchAPI` (server-side only)
- ❌ `clientFetch` (client-side only)
- ❌ `api-client.ts` (unused, complex)
- ❌ Scattered services: `user-servces.ts`, `project-services.ts`, `message-service.ts`
- ❌ Inconsistent error handling
- ❌ Confusing which to use where

### After (Clean):
- ✅ **One unified `apiFetch`** - works everywhere (client & server)
- ✅ **Organized by domain**: `usersAPI`, `projectsAPI`, `messagesAPI`
- ✅ **Centralized endpoints** in `config.ts`
- ✅ **Consistent error handling**
- ✅ **Type-safe throughout**
- ✅ **Single import** point

## 📁 New Structure

```
lib/api/
├── index.ts         # Single export point
├── fetch.ts         # Universal fetch utility
├── config.ts        # Endpoints & configuration
├── users.ts         # User API methods
├── projects.ts      # Project API methods
└── messages.ts      # Messages & workflow API methods
```

## 🚀 Migration Examples

### Old Way:
```typescript
// Confusing - which one to use?
import projectServices from "@/lib/services/project-services";
import { clientFetch } from "@/lib/client-fetch";
import { fetchAPI } from "@/lib/fetch-api";

// Scattered logic
const project = await projectServices.createProject({ user_prompt: "..." });
```

### New Way:
```typescript
// Simple - one import
import { projectsAPI } from "@/lib/api";

// Clean, consistent
const response = await projectsAPI.create({ user_prompt: "..." });
if (response.error) {
  console.error(response.error);
} else {
  const project = response.data;
}
```

## 📝 Usage Patterns

### 1. In Server Components:
```typescript
import { projectsAPI } from "@/lib/api";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { data: project, error } = await projectsAPI.getById(params.id);
  
  if (error) return <div>Error: {error}</div>;
  return <div>{project.name}</div>;
}
```

### 2. In Client Components:
```typescript
"use client";
import { usersAPI } from "@/lib/api";

export function OnboardingForm() {
  const handleSubmit = async (data) => {
    const response = await usersAPI.completeOnboarding(data);
    if (response.error) {
      setError(response.error);
    } else {
      // Success!
    }
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 3. In Hooks:
```typescript
import { messagesAPI } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useWorkflow(projectId: string) {
  const { data, error } = useQuery({
    queryKey: ["messages", projectId],
    queryFn: () => messagesAPI.list(projectId),
  });
  
  return { messages: data?.data?.messages, error };
}
```

## 🔄 Migration Checklist

- [ ] Update `auth.ts` to use `usersAPI.signIn()`
- [ ] Update `prompt-input.tsx` to use `projectsAPI.create()`
- [ ] Update `getting-started/page.tsx` to use `usersAPI.completeOnboarding()`
- [ ] Update `use-workflow.ts` hook to use `messagesAPI`
- [ ] Update `project/[id]/page.tsx` to use `projectsAPI.getById()`
- [ ] Update `home/projects/page.tsx` to use `projectsAPI.list()`
- [ ] Delete old files:
  - `lib/api-client.ts`
  - `lib/client-fetch.ts`
  - `lib/fetch-api.ts`
  - `lib/services/user-servces.ts`
  - `lib/services/project-services.ts`
  - `lib/services/message-service.ts`

## ✨ Benefits

1. **Simpler mental model**: One fetch function, works everywhere
2. **Better organization**: APIs grouped by domain
3. **Easier to maintain**: Change endpoint once, updates everywhere
4. **Type-safe**: Full TypeScript support
5. **Consistent errors**: Same error structure everywhere
6. **Less code**: Removed ~200 lines of redundant code
7. **Better DX**: Single import, autocomplete shows all methods

## 🎓 Best Practices

### ✅ DO:
```typescript
import { projectsAPI, usersAPI } from "@/lib/api";

const { data, error } = await projectsAPI.getById(id);
if (error) throw new Error(error);
```

### ❌ DON'T:
```typescript
// Don't import from individual files
import { apiFetch } from "@/lib/api/fetch";

// Don't throw errors in API layer - return them
```

## 🔧 Advanced: Custom Fetch Options

```typescript
import { apiFetch } from "@/lib/api";

// Custom headers
const response = await apiFetch("/custom/endpoint", {
  method: "POST",
  body: { data: "..." },
  headers: {
    "X-Custom-Header": "value",
  },
});
```

## 📊 Error Handling Pattern

```typescript
const response = await projectsAPI.create(data);

if (response.error) {
  // Handle error
  if (response.status === 401) {
    // Redirect to login
  } else if (response.status === 400) {
    // Show validation error
  } else {
    // Generic error
  }
} else {
  // Success - use response.data
  const project = response.data;
}
```

---

**Result**: Clean, maintainable, professional API layer! 🚀

---
name: Frontend Stack
description: UI and state management libraries added to the SQL Inspector frontend
type: project
---

shadcn/ui (Nova preset, Radix primitives, Geist font) + Tailwind CSS v4 + @tailwindcss/vite were added for UI.
Zustand for client/UI state, TanStack Query for server state (API calls).
react-hook-form + zod for form validation.

**Why:** User chose these after a discussion — shadcn/ui over raw Radix for ready-made components, Zustand over Redux for simplicity, TanStack Query to handle API caching/loading states.

**How to apply:** New API resources should add TanStack Query hooks in `src/hooks/`. UI state (selection, dialogs) belongs in Zustand store (`src/store/index.ts`). Form components use react-hook-form + zod with `z.number()` + `{ valueAsNumber: true }` for numeric fields (not `z.coerce.number()` — incompatible with react-hook-form resolver types).

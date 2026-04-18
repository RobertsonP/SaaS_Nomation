---
name: nomation-frontend-patterns
description: Frontend coding patterns, component conventions, and styling rules for Nomation's React frontend. Load when creating or modifying frontend components, pages, hooks, or styles. Ensures consistency across the UI.
---

# Frontend Patterns

## Tech Stack
- React 18 with TypeScript strict
- Vite for build/dev server
- Tailwind CSS for all styling (no CSS modules, no styled-components)
- Radix UI for accessible primitives (Dialog, DropdownMenu, Toast)
- Lucide React for icons
- dnd-kit for drag-and-drop (test builder)
- @xyflow/react for flow diagrams (sitemap)
- Socket.IO client for real-time WebSocket communication
- axios for API calls (via lib/api.ts wrapper)

## State Management
- React Context for global state: AuthContext, ProjectsContext, DiscoveryContext, NotificationContext, ThemeContext
- Custom hooks for async operations: useAsyncOperation, usePolling, useWebSocket
- localStorage for unsaved test steps persistence (key: nomation-test-steps-v1-{testId})
- No Redux, no Zustand, no external state library

## Component Patterns
- Functional components only (no class components)
- Props interface defined above component
- createLogger('ComponentName') for logging
- Error boundaries wrap major page sections
- Loading states handled with isLoading boolean props
- Empty states handled explicitly (not just showing nothing)

## API Layer (lib/api.ts)
- All API calls go through the api axios instance
- browserAPI uses public endpoints (no auth needed for live sessions)
- testsAPI, executionAPI, projectsAPI, suitesAPI — organized by domain
- Error handling: try/catch with notification context for user-facing errors

## Styling Rules
- Tailwind only — no inline styles except dynamic values
- Dark mode: always include dark: variants (dark:bg-gray-800, dark:text-gray-200)
- Responsive: mobile-first, sm: md: lg: breakpoints
- Colors: blue-600 primary, gray-* neutral, green-* success, red-* error, yellow-* warning
- Spacing: consistent p-4 / p-6 for cards, gap-4 for grids
- Rounded corners: rounded-lg for cards, rounded-md for buttons, rounded-full for badges

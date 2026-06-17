# FlowBoard

A real-time collaborative Kanban board. Multiple users can create, edit, and drag tasks between columns, comment on tasks, and see every change sync instantly across all connected clients — no refresh needed.
flowboard-project/

├── client/   React + TypeScript frontend

└── server/   Node.js + Express + WebSocket backend
**Live demo:** https://flowboard-blond-two.vercel.app
*(Note: the backend is on Render's free tier, so the first request after a period of inactivity may take 30-60 seconds while the server wakes up.)*

## Features

- Drag-and-drop task management across columns (To Do / In Progress / Done)
- Real-time multi-user sync via WebSockets — every action (create, edit, delete, move, comment) broadcasts live to all connected clients
- Live cursor tracking — see other users' mouse positions moving on screen in real time
- Online presence indicators showing who is currently connected
- Comments on individual tasks, synced live
- Activity timeline showing a real-time feed of all actions taken on the board
- Persistent storage — board state survives server restarts
- Form validation on task creation and editing
- Keyboard-accessible drag and drop
- Responsive layout for mobile and desktop
- Unit tests covering the core state-transition logic (add, update, delete, move)

## Tech Stack

**Frontend (`client/`):** React, TypeScript, Vite, Zustand, dnd-kit, Vitest

**Backend (`server/`):** Node.js, Express, ws (WebSocket server), file-based persistence

## Why these choices

- **One repo instead of two** — the client and server are small enough, and tightly enough coupled in purpose, that splitting them would mean two READMEs and two places to look for one system. A monorepo with clear `client/` and `server/` folders keeps the whole architecture visible in one place. This trades away independent deploy-pipeline isolation, which would matter more at a larger scale with separate teams owning each piece.
- **Zustand over Redux** — same single-source-of-truth model with direct function calls instead of action/reducer/dispatch boilerplate, while staying simple enough for a project this size.
- **Normalized state** (tasks and columns as flat objects linked by ID, not nested) — moving a task between columns becomes "update two arrays of IDs," and it is the same shape that makes broadcasting small diffs over WebSocket tractable.
- **dnd-kit over react-dnd** — first-class keyboard and touch support out of the box, which matters for accessibility and mobile use.
- **WebSockets over polling** — task moves, comments, and cursor positions need to feel instant; polling would add latency and unnecessary network load.
- **JSON file over a database for persistence** — the data is small, has a single-writer pattern (one server process), and needs no relational queries. A flat file rewritten on change gives durability across restarts without the operational overhead of running and managing a separate database service. This would not scale to multiple concurrent server instances, at which point a real database becomes the right call.
- **Pure functions extracted for the core state logic** (`client/src/store/boardLogic.ts`) — the WebSocket message handler in the Zustand store calls into plain, side-effect-free functions (`applyAddTask`, `applyMoveTask`, etc.) rather than inlining the array/object manipulation. This means the exact logic that runs in production is the same logic covered by unit tests — there's no separate "tested copy" that could silently drift from what actually runs.

## Running locally

**Backend:**
```bash
cd server
npm install
npm run dev
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

Open the printed URL (typically `http://localhost:5173`). Open it in a second browser tab to see real-time sync, presence, and live cursors in action.

## Running tests

```bash
cd client
npm test
```

## What I would build next

- User authentication (currently each connection gets a random display name)
- Integration tests for the drag-and-drop interaction itself, beyond the current unit tests on state logic
- A real database in place of the JSON file, if the app needed to scale beyond a single server instance
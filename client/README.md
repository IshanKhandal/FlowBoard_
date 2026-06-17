# FlowBoard

A real-time collaborative Kanban board built with React, TypeScript, and WebSockets. Multiple users can create, edit, and drag tasks between columns and see every change sync instantly across all connected clients — no refresh needed.

## Features

- Drag-and-drop task management across columns (To Do / In Progress / Done)
- Real-time multi-user sync via WebSockets — every action (create, edit, delete, move) broadcasts live to all connected clients
- Live cursor tracking — see other users' mouse positions moving on screen in real time
- Online presence indicators showing who's currently connected
- Form validation on task creation/editing
- Keyboard-accessible drag and drop
- Responsive layout for mobile and desktop

## Tech Stack

**Frontend:** React, TypeScript, Vite, Zustand (state management), dnd-kit (drag and drop)

**Backend:** Node.js, Express, ws (WebSocket server)

## Why these choices

- **Zustand over Redux** — same single-source-of-truth model with direct function calls instead of action/reducer/dispatch boilerplate, while staying simple enough for this project's size.
- **Normalized state** (tasks and columns as flat objects linked by ID, not nested) — moving a task between columns becomes "update two arrays of IDs" instead of finding and re-nesting objects, and it's the same shape that makes broadcasting small diffs over WebSocket tractable.
- **dnd-kit over react-dnd** — first-class keyboard and touch support out of the box, which matters for accessibility and mobile use.
- **WebSockets over polling** — task moves and cursor positions need to feel instant; polling would add latency and unnecessary network load.

## Running locally

**Backend:**
```bash
cd flowboard-server
npm install
npm run dev
```

**Frontend:**
```bash
cd flowboard
npm install
npm run dev
```

Open the printed URL (typically `http://localhost:5173`). Open it in a second browser tab to see real-time sync in action.

## What I'd build next

- Persistent storage (currently state lives in server memory and resets on restart)
- User authentication (currently users get a random name on connect)
- Comments and activity timeline per task
- Automated tests (unit + integration)
- CI/CD pipeline and deployment
<img src="logo.svg" width="48" height="48" alt="FlowBoard logo" />

# FlowBoard

<!-- 📸 Add a screenshot or short GIF of the board here — drag-and-drop in action sells this instantly -->

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-FF6B6B)
![Tests](https://img.shields.io/badge/tests-10%20passing-7C9A82)

### Drag a card. Watch it move on someone else's screen, instantly.

A real-time collaborative Kanban board built in React, TypeScript, and WebSockets. Multiple people work the same board at once — every move, comment, and cursor position syncs live, no refresh, no polling, no delay.

**Live:** https://flowboard-blond-two.vercel.app
*(Backend runs on Render's free tier — the first load after inactivity can take 30–60 seconds to wake up.)*

## What it does

- Drag-and-drop tasks across To Do / In Progress / Done, synced live across every connected client
- Live cursors — see exactly where everyone else on the board is pointing, in real time
- Online presence, so you know who's here right now
- Comments on tasks, synced instantly
- A running activity feed of every action taken on the board
- Sign in with GitHub, or skip straight in as a guest
- Board state survives server restarts
- Form validation, keyboard-accessible drag and drop, responsive on mobile
- 10 unit tests covering the core state logic

## Built with

**Client:** React, TypeScript, Vite, Zustand, dnd-kit, Vitest
**Server:** Node.js, Express, ws, GitHub OAuth, file-based persistence

## The decisions behind it

**One repo, not two.** Client and server are small enough and tightly coupled enough in purpose that splitting them just means two READMEs for one system. The trade-off: no independent deploy isolation, which matters more at a scale this project isn't at.

**Zustand over Redux.** Same single-source-of-truth model, direct function calls instead of action/reducer/dispatch ceremony. Right amount of structure for this size.

**Normalized state.** Tasks and columns live as flat objects linked by ID, not nested. Moving a task between columns becomes "update two arrays of IDs" — and it's the same shape that makes broadcasting small diffs over a socket actually tractable.

**dnd-kit over react-dnd.** Keyboard and touch support out of the box, which matters for both accessibility and mobile.

**WebSockets, not polling.** A task move or a cursor position has to feel instant. Polling adds latency a collaborative board can't afford.

**A JSON file, not a database.** Single server process, single writer, no relational queries needed. A flat file rewritten on change gives durability without the operational weight of running a separate database — until the app needs more than one server instance, at which point this stops being the right call.

**A signed session map, not a JWT.** Sessions live server-side in memory, the same philosophy as the JSON file: simple, and trivially revocable. Logout deletes the entry and the cookie is instantly worthless — no blocklist required. The trade-off is sessions don't survive a server restart, which is already true of the live WebSocket state, so it's not a new gap, just a consistent one.

**Pure functions for the core logic.** The WebSocket handler calls into plain, side-effect-free functions (`applyAddTask`, `applyMoveTask`, etc.) instead of inlining the array work. The exact logic running in production is the same logic the tests cover — no separate tested copy that could quietly drift from what actually runs.

## Run it yourself

**Server:**
```bash
cd server
npm install
npm run dev
```

**Client:**
```bash
cd client
npm install
npm run dev
```

Open the printed URL, then open it again in a second tab. Drag a card. Watch the other tab.

## Tests

```bash
cd client
npm test
```

import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";
import {
  createSession,
  getSession,
  destroySession,
  parseCookies,
  exchangeCodeForUser,
} from "./auth";

const SESSION_COOKIE = "flowboard_session";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function setSessionCookie(res: express.Response, sessionId: string) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  columnId: string;
  createdAt: number;
}

interface Column {
  id: string;
  title: string;
  taskIds: string[];
}

interface BoardState {
  tasks: Record<string, Task>;
  columns: Record<string, Column>;
  columnOrder: string[];
}

interface ActivityEntry {
  id: string;
  message: string;
  timestamp: number;
}

interface Comment {
  id: string;
  taskId: string;
  authorName: string;
  authorColor: string;
  text: string;
  timestamp: number;
}

interface PersistedData {
  state: BoardState;
  activityLog: ActivityEntry[];
  comments: Record<string, Comment[]>;
}

const DATA_FILE = path.join(__dirname, "..", "data.json");

const USER_COLORS = [
  "#5B5FE3", "#E8745B", "#7C9A82", "#C98A3E", "#3E8FC9", "#9A5BC9",
];

const GUEST_NAMES = [
  "Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery",
];

function loadData(): PersistedData {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    } catch {
      // fall through to default
    }
  }
  return {
    state: {
      tasks: {
        "task-1": {
          id: "task-1",
          title: "Set up project structure",
          description: "Initialize Vite + React + TypeScript, configure folder layout.",
          priority: "high",
          columnId: "col-done",
          createdAt: Date.now() - 86400000 * 2,
        },
        "task-2": {
          id: "task-2",
          title: "Design the data model",
          description: "Decide between normalized vs nested state for tasks and columns.",
          priority: "high",
          columnId: "col-done",
          createdAt: Date.now() - 86400000 * 2,
        },
        "task-3": {
          id: "task-3",
          title: "Build drag and drop",
          description: "Wire up dnd-kit so tasks can move between columns smoothly.",
          priority: "medium",
          columnId: "col-progress",
          createdAt: Date.now() - 3600000 * 5,
        },
        "task-4": {
          id: "task-4",
          title: "Add task creation form",
          description: "Modal with title, description, and priority fields, with validation.",
          priority: "medium",
          columnId: "col-todo",
          createdAt: Date.now() - 3600000 * 2,
        },
        "task-5": {
          id: "task-5",
          title: "Write README and decisions doc",
          description: "Document why each library was chosen, for the internship review.",
          priority: "low",
          columnId: "col-todo",
          createdAt: Date.now() - 3600000,
        },
      },
      columns: {
        "col-todo": { id: "col-todo", title: "To Do", taskIds: ["task-4", "task-5"] },
        "col-progress": { id: "col-progress", title: "In Progress", taskIds: ["task-3"] },
        "col-done": { id: "col-done", title: "Done", taskIds: ["task-1", "task-2"] },
      },
      columnOrder: ["col-todo", "col-progress", "col-done"],
    },
    activityLog: [],
    comments: {},
  };
}

let { state, activityLog, comments } = loadData();

let saveTimeout: NodeJS.Timeout | null = null;
function saveData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const data: PersistedData = { state, activityLog, comments };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  }, 150);
}

const app = express();
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.get("/auth/github", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("GitHub OAuth is not configured.");
    return;
  }
  const callbackUrl = `${req.protocol}://${req.get("host")}/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    callbackUrl
  )}&scope=read:user`;
  res.redirect(githubAuthUrl);
});

app.get("/auth/github/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${FRONTEND_URL}?auth_error=missing_code`);
    return;
  }

  try {
    const user = await exchangeCodeForUser(code);
    const sessionId = createSession(user);
    setSessionCookie(res, sessionId);
    res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error("GitHub OAuth callback failed:", err);
    res.redirect(`${FRONTEND_URL}?auth_error=github_failed`);
  }
});

app.get("/auth/me", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const user = getSession(cookies[SESSION_COOKIE]);
  res.json({ user });
});

app.post("/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  destroySession(cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

interface ConnectedUser {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  provider: "github" | "guest";
  ws: WebSocket;
}

const connectedUsers = new Map<WebSocket, ConnectedUser>();

function broadcast(message: unknown, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function getOnlineUsers() {
  return Array.from(connectedUsers.values()).map((u) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    avatarUrl: u.avatarUrl,
    provider: u.provider,
  }));
}

function logActivity(message: string) {
  const entry: ActivityEntry = { id: uuid(), message, timestamp: Date.now() };
  activityLog = [entry, ...activityLog].slice(0, 50);
  broadcast({ type: "ACTIVITY_ADDED", entry });
}

wss.on("connection", (ws, req) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionUser = getSession(cookies[SESSION_COOKIE]);

  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const requestedGuestName = url.searchParams.get("guestName");

  const userId = sessionUser?.id ?? uuid();
  const name =
    sessionUser?.name ??
    (requestedGuestName?.trim() ||
      GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]);
  const color = sessionUser?.color ?? USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  const avatarUrl = sessionUser?.avatarUrl ?? null;
  const provider = sessionUser?.provider ?? "guest";

  const user: ConnectedUser = { id: userId, name, color, avatarUrl, provider, ws };
  connectedUsers.set(ws, user);

  ws.send(
    JSON.stringify({
      type: "INIT",
      state,
      user: { id: userId, name, color, avatarUrl, provider },
      users: getOnlineUsers(),
      activityLog,
      comments,
    })
  );

  broadcast({ type: "USER_JOINED", users: getOnlineUsers() }, ws);
  logActivity(`${name} joined the board`);

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    const currentUser = connectedUsers.get(ws);
    if (!currentUser) return;

    switch (msg.type) {
      case "ADD_TASK": {
        const taskId = uuid();
        const task: Task = {
          id: taskId,
          title: msg.title,
          description: msg.description,
          priority: msg.priority,
          columnId: msg.columnId,
          createdAt: Date.now(),
        };
        state.tasks[taskId] = task;
        state.columns[msg.columnId].taskIds.push(taskId);
        broadcast({ type: "TASK_ADDED", task });
        logActivity(`${currentUser.name} added "${task.title}"`);
        saveData();
        break;
      }

      case "UPDATE_TASK": {
        const task = state.tasks[msg.taskId];
        if (!task) return;
        state.tasks[msg.taskId] = { ...task, ...msg.updates };
        broadcast({ type: "TASK_UPDATED", taskId: msg.taskId, updates: msg.updates });
        logActivity(`${currentUser.name} edited "${task.title}"`);
        saveData();
        break;
      }

      case "DELETE_TASK": {
        const task = state.tasks[msg.taskId];
        if (!task) return;
        delete state.tasks[msg.taskId];
        state.columns[task.columnId].taskIds = state.columns[task.columnId].taskIds.filter(
          (id) => id !== msg.taskId
        );
        broadcast({ type: "TASK_DELETED", taskId: msg.taskId });
        logActivity(`${currentUser.name} deleted "${task.title}"`);
        saveData();
        break;
      }

      case "MOVE_TASK": {
        const { taskId, sourceColumnId, destColumnId, destIndex } = msg;
        const sourceColumn = state.columns[sourceColumnId];
        const destColumn = state.columns[destColumnId];
        if (!sourceColumn || !destColumn || !state.tasks[taskId]) return;

        const sourceTaskIds = sourceColumn.taskIds.filter((id) => id !== taskId);
        const destTaskIds =
          sourceColumnId === destColumnId ? sourceTaskIds : [...destColumn.taskIds];
        destTaskIds.splice(destIndex, 0, taskId);

        state.tasks[taskId].columnId = destColumnId;
        state.columns[sourceColumnId].taskIds = sourceTaskIds;
        state.columns[destColumnId].taskIds = destTaskIds;

        broadcast({ type: "TASK_MOVED", taskId, sourceColumnId, destColumnId, destIndex });
        saveData();
        break;
      }

      case "CURSOR_MOVE": {
        broadcast(
          { type: "CURSOR_MOVE", userId: currentUser.id, name: currentUser.name, color: currentUser.color, x: msg.x, y: msg.y },
          ws
        );
        break;
      }

      case "ADD_COMMENT": {
        const comment: Comment = {
          id: uuid(),
          taskId: msg.taskId,
          authorName: currentUser.name,
          authorColor: currentUser.color,
          text: msg.text,
          timestamp: Date.now(),
        };
        if (!comments[msg.taskId]) comments[msg.taskId] = [];
        comments[msg.taskId].push(comment);
        broadcast({ type: "COMMENT_ADDED", comment });
        saveData();
        break;
      }
    }
  });

  ws.on("close", () => {
    const user = connectedUsers.get(ws);
    connectedUsers.delete(ws);
    if (user) {
      broadcast({ type: "USER_LEFT", users: getOnlineUsers() });
      logActivity(`${user.name} left the board`);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`FlowBoard server running on http://localhost:${PORT}`);
  console.log("WebSocket server ready");
});
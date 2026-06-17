import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

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

const defaultState: BoardState = {
  tasks: {
    "task-1": { id: "task-1", title: "Set up project structure", description: "Initialize Vite + React + TypeScript.", priority: "high", columnId: "col-done", createdAt: Date.now() - 86400000 * 2 },
    "task-2": { id: "task-2", title: "Design the data model", description: "Normalized vs nested state decision.", priority: "high", columnId: "col-done", createdAt: Date.now() - 86400000 },
    "task-3": { id: "task-3", title: "Build drag and drop", description: "Wire up dnd-kit between columns.", priority: "medium", columnId: "col-progress", createdAt: Date.now() - 3600000 * 5 },
    "task-4": { id: "task-4", title: "Add task creation form", description: "Modal with validation.", priority: "medium", columnId: "col-todo", createdAt: Date.now() - 3600000 * 2 },
    "task-5": { id: "task-5", title: "Write README and decisions doc", description: "Document library choices.", priority: "low", columnId: "col-todo", createdAt: Date.now() - 3600000 },
  },
  columns: {
    "col-todo": { id: "col-todo", title: "To Do", taskIds: ["task-4", "task-5"] },
    "col-progress": { id: "col-progress", title: "In Progress", taskIds: ["task-3"] },
    "col-done": { id: "col-done", title: "Done", taskIds: ["task-1", "task-2"] },
  },
  columnOrder: ["col-todo", "col-progress", "col-done"],
};

function loadData(): PersistedData {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse data.json, falling back to defaults:", e);
    }
  }
  return { state: defaultState, activityLog: [], comments: {} };
}

let saveTimeout: NodeJS.Timeout | null = null;
function saveData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const data: PersistedData = { state, activityLog, comments };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  }, 150);
}

const loaded = loadData();
const state: BoardState = loaded.state;
const activityLog: ActivityEntry[] = loaded.activityLog;
const comments: Record<string, Comment[]> = loaded.comments;

const clients = new Map<WebSocket, { id: string; name: string; color: string }>();

const USER_COLORS = ["#5B5FE3", "#E8745B", "#7C9A82", "#C98A3E", "#9B59B6", "#E74C3C"];
const USER_NAMES = ["Alex", "Sam", "Jordan", "Casey", "Riley", "Morgan"];

function broadcast(message: object, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  clients.forEach((_, client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function broadcastAll(message: object) {
  const data = JSON.stringify(message);
  clients.forEach((_, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function logActivity(message: string) {
  const entry: ActivityEntry = { id: uuid(), message, timestamp: Date.now() };
  activityLog.unshift(entry);
  if (activityLog.length > 50) activityLog.pop();
  broadcastAll({ type: "ACTIVITY_ADDED", entry });
  saveData();
}

wss.on("connection", (ws) => {
  const userIndex = Math.floor(Math.random() * USER_NAMES.length);
  const user = { id: uuid(), name: USER_NAMES[userIndex], color: USER_COLORS[userIndex] };
  clients.set(ws, user);

  ws.send(JSON.stringify({ type: "INIT", state, user, users: Array.from(clients.values()), activityLog, comments }));
  broadcast({ type: "USER_JOINED", user, users: Array.from(clients.values()) }, ws);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      switch (msg.type) {
        case "ADD_TASK": {
          const id = uuid();
          const task: Task = { id, title: msg.title, description: msg.description, priority: msg.priority, columnId: msg.columnId, createdAt: Date.now() };
          state.tasks[id] = task;
          state.columns[msg.columnId].taskIds.push(id);
          broadcastAll({ type: "TASK_ADDED", task });
          logActivity(`${user.name} created "${task.title}"`);
          saveData();
          break;
        }
        case "UPDATE_TASK": {
          state.tasks[msg.taskId] = { ...state.tasks[msg.taskId], ...msg.updates };
          broadcastAll({ type: "TASK_UPDATED", taskId: msg.taskId, updates: msg.updates });
          logActivity(`${user.name} edited "${state.tasks[msg.taskId].title}"`);
          saveData();
          break;
        }
        case "DELETE_TASK": {
          const task = state.tasks[msg.taskId];
          if (!task) break;
          delete state.tasks[msg.taskId];
          state.columns[task.columnId].taskIds = state.columns[task.columnId].taskIds.filter((id) => id !== msg.taskId);
          broadcastAll({ type: "TASK_DELETED", taskId: msg.taskId, columnId: task.columnId });
          logActivity(`${user.name} deleted "${task.title}"`);
          saveData();
          break;
        }
        case "MOVE_TASK": {
          const { taskId, sourceColumnId, destColumnId, destIndex } = msg;
          const movedTaskTitle = state.tasks[taskId].title;
          state.columns[sourceColumnId].taskIds = state.columns[sourceColumnId].taskIds.filter((id) => id !== taskId);
          const destIds = sourceColumnId === destColumnId ? state.columns[sourceColumnId].taskIds : [...state.columns[destColumnId].taskIds];
          destIds.splice(destIndex, 0, taskId);
          state.columns[destColumnId].taskIds = destIds;
          state.tasks[taskId].columnId = destColumnId;
          broadcastAll({ type: "TASK_MOVED", taskId, sourceColumnId, destColumnId, destIndex });
          if (sourceColumnId !== destColumnId) {
            logActivity(`${user.name} moved "${movedTaskTitle}" to ${state.columns[destColumnId].title}`);
          }
          saveData();
          break;
        }
        case "CURSOR_MOVE": {
          broadcast({ type: "CURSOR_MOVE", userId: user.id, x: msg.x, y: msg.y, name: user.name, color: user.color }, ws);
          break;
        }
        case "ADD_COMMENT": {
          const comment: Comment = {
            id: uuid(),
            taskId: msg.taskId,
            authorName: user.name,
            authorColor: user.color,
            text: msg.text,
            timestamp: Date.now(),
          };
          if (!comments[msg.taskId]) comments[msg.taskId] = [];
          comments[msg.taskId].push(comment);
          broadcastAll({ type: "COMMENT_ADDED", comment });
          saveData();
          break;
        }
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    broadcastAll({ type: "USER_LEFT", userId: user.id, users: Array.from(clients.values()) });
  });
});

app.get("/api/board", (_req, res) => {
  res.json(state);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`FlowBoard server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready`);
});

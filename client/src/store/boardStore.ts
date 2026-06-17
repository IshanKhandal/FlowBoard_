import { create } from "zustand";
import type { BoardState, Task, Priority } from "../types";
import { applyAddTask, applyUpdateTask, applyDeleteTask, applyMoveTask } from "./boardLogic";

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

interface CurrentUser {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  provider: "github" | "guest";
}

interface BoardStore extends BoardState {
  ws: WebSocket | null;
  connected: boolean;
  currentUser: CurrentUser | null;
  onlineUsers: CurrentUser[];
  activityLog: ActivityEntry[];
  comments: Record<string, Comment[]>;
  connect: (guestName?: string) => void;
  addTask: (columnId: string, title: string, description: string, priority: Priority) => void;
  updateTask: (taskId: string, updates: Partial<Pick<Task, "title" | "description" | "priority">>) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, sourceColumnId: string, destColumnId: string, destIndex: number) => void;
  sendCursor: (x: number, y: number) => void;
  addComment: (taskId: string, text: string) => void;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  ws: null,
  connected: false,
  currentUser: null,
  onlineUsers: [],
  tasks: {},
  columns: {},
  columnOrder: [],
  activityLog: [],
  comments: {},

  /**
   * WHY DOES connect() TAKE AN OPTIONAL guestName?
   *
   * A signed-in user already has a session cookie, so the server can
   * identify them without any extra info from this call. A guest has
   * no cookie, so the only way to carry their chosen display name to
   * the server is on the connection itself — here, as a query param on
   * the WebSocket URL. The server checks the session cookie FIRST and
   * only falls back to this query param if no session exists, so a
   * guest can never use this to impersonate a logged-in identity.
   */
  connect: (guestName) => {
    const existing = get().ws;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
    const url = guestName ? `${wsUrl}/?guestName=${encodeURIComponent(guestName)}` : wsUrl;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      set({ ws, connected: true });
    };

    ws.onclose = () => {
      set({ connected: false, ws: null });
      setTimeout(() => get().connect(guestName), 2000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "INIT":
          set({
            tasks: msg.state.tasks,
            columns: msg.state.columns,
            columnOrder: msg.state.columnOrder,
            currentUser: msg.user,
            onlineUsers: msg.users,
            activityLog: msg.activityLog ?? [],
            comments: msg.comments ?? {},
          });
          break;

        case "USER_JOINED":
        case "USER_LEFT":
          set({ onlineUsers: msg.users });
          break;

        case "TASK_ADDED": {
          const { task } = msg;
          set((state) =>
            applyAddTask(state, task.id, task.columnId, task.title, task.description, task.priority)
          );
          break;
        }

        case "TASK_UPDATED":
          set((state) => applyUpdateTask(state, msg.taskId, msg.updates));
          break;

        case "TASK_DELETED":
          set((state) => applyDeleteTask(state, msg.taskId));
          break;

        case "TASK_MOVED":
          set((state) =>
            applyMoveTask(state, msg.taskId, msg.sourceColumnId, msg.destColumnId, msg.destIndex)
          );
          break;

        case "CURSOR_MOVE":
          window.dispatchEvent(new CustomEvent("remote-cursor", { detail: msg }));
          break;

        case "ACTIVITY_ADDED":
          set((state) => ({
            activityLog: [msg.entry, ...state.activityLog].slice(0, 50),
          }));
          break;

        case "COMMENT_ADDED":
          set((state) => ({
            comments: {
              ...state.comments,
              [msg.comment.taskId]: [...(state.comments[msg.comment.taskId] ?? []), msg.comment],
            },
          }));
          break;
      }
    };

    set({ ws });
  },

  addTask: (columnId, title, description, priority) => {
    get().ws?.send(JSON.stringify({ type: "ADD_TASK", columnId, title, description, priority }));
  },

  updateTask: (taskId, updates) => {
    get().ws?.send(JSON.stringify({ type: "UPDATE_TASK", taskId, updates }));
  },

  deleteTask: (taskId) => {
    get().ws?.send(JSON.stringify({ type: "DELETE_TASK", taskId }));
  },

  moveTask: (taskId, sourceColumnId, destColumnId, destIndex) => {
    get().ws?.send(JSON.stringify({ type: "MOVE_TASK", taskId, sourceColumnId, destColumnId, destIndex }));
  },

  sendCursor: (x, y) => {
    const socket = get().ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "CURSOR_MOVE", x, y }));
    }
  },

  addComment: (taskId, text) => {
    get().ws?.send(JSON.stringify({ type: "ADD_COMMENT", taskId, text }));
  },
}));
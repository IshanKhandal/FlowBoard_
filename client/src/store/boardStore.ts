import { create } from "zustand";
import type { BoardState, Task, Priority } from "../types";

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

interface BoardStore extends BoardState {
  ws: WebSocket | null;
  connected: boolean;
  currentUser: { id: string; name: string; color: string } | null;
  onlineUsers: { id: string; name: string; color: string }[];
  activityLog: ActivityEntry[];
  comments: Record<string, Comment[]>;
  connect: () => void;
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

  connect: () => {
    const existing = get().ws;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:3001"; const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ ws, connected: true });
    };

    ws.onclose = () => {
      set({ connected: false, ws: null });
      setTimeout(() => get().connect(), 2000);
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

        case "TASK_ADDED":
          set((state) => ({
            tasks: { ...state.tasks, [msg.task.id]: msg.task },
            columns: {
              ...state.columns,
              [msg.task.columnId]: {
                ...state.columns[msg.task.columnId],
                taskIds: [...state.columns[msg.task.columnId].taskIds, msg.task.id],
              },
            },
          }));
          break;

        case "TASK_UPDATED":
          set((state) => ({
            tasks: {
              ...state.tasks,
              [msg.taskId]: { ...state.tasks[msg.taskId], ...msg.updates },
            },
          }));
          break;

        case "TASK_DELETED":
          set((state) => {
            const { [msg.taskId]: _, ...remainingTasks } = state.tasks;
            return {
              tasks: remainingTasks,
              columns: {
                ...state.columns,
                [msg.columnId]: {
                  ...state.columns[msg.columnId],
                  taskIds: state.columns[msg.columnId].taskIds.filter((id) => id !== msg.taskId),
                },
              },
            };
          });
          break;

        case "TASK_MOVED":
          set((state) => {
            const { taskId, sourceColumnId, destColumnId, destIndex } = msg;
            const sourceIds = state.columns[sourceColumnId].taskIds.filter((id) => id !== taskId);
            const destIds = sourceColumnId === destColumnId
              ? [...sourceIds]
              : [...state.columns[destColumnId].taskIds];
            destIds.splice(destIndex, 0, taskId);
            return {
              tasks: { ...state.tasks, [taskId]: { ...state.tasks[taskId], columnId: destColumnId } },
              columns: {
                ...state.columns,
                [sourceColumnId]: { ...state.columns[sourceColumnId], taskIds: sourceIds },
                [destColumnId]: { ...state.columns[destColumnId], taskIds: destIds },
              },
            };
          });
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
    get().ws?.send(JSON.stringify({ type: "CURSOR_MOVE", x, y }));
  },

  addComment: (taskId, text) => {
    get().ws?.send(JSON.stringify({ type: "ADD_COMMENT", taskId, text }));
  },
}));

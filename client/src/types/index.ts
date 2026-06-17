/**
 * Core domain types for FlowBoard.
 *
 * Why a separate types file instead of inline types in components?
 * Because these shapes are shared across the store, multiple components,
 * and (in Phase 2) the API layer. Defining them once and importing
 * everywhere keeps the whole app in sync — change a field here, and
 * TypeScript will flag every place that breaks.
 */

export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  columnId: string;
  createdAt: number; // stored as a timestamp, not a Date object —
  // Dates aren't easily serializable to JSON, which matters once
  // this data is persisted (Phase 2) or sent over a socket (Phase 3).
}

export interface Column {
  id: string;
  title: string;
  taskIds: string[]; // we store an ORDER of task ids here, not the
  // tasks themselves. This is the key architectural decision of the
  // whole app — see store/boardStore.ts for the full reasoning.
}

export interface BoardState {
  columns: Record<string, Column>;
  tasks: Record<string, Task>;
  columnOrder: string[];
}
import type { Task, Column, Priority } from "../types";

export interface BoardData {
  tasks: Record<string, Task>;
  columns: Record<string, Column>;
}

export function applyAddTask(
  state: BoardData,
  taskId: string,
  columnId: string,
  title: string,
  description: string,
  priority: Priority
): BoardData {
  const newTask: Task = { id: taskId, title, description, priority, columnId, createdAt: Date.now() };
  return {
    tasks: { ...state.tasks, [taskId]: newTask },
    columns: {
      ...state.columns,
      [columnId]: {
        ...state.columns[columnId],
        taskIds: [...state.columns[columnId].taskIds, taskId],
      },
    },
  };
}

export function applyUpdateTask(
  state: BoardData,
  taskId: string,
  updates: Partial<Pick<Task, "title" | "description" | "priority">>
): BoardData {
  if (!state.tasks[taskId]) return state;
  return {
    ...state,
    tasks: { ...state.tasks, [taskId]: { ...state.tasks[taskId], ...updates } },
  };
}

export function applyDeleteTask(state: BoardData, taskId: string): BoardData {
  const task = state.tasks[taskId];
  if (!task) return state;

  const { [taskId]: _removed, ...remainingTasks } = state.tasks;

  return {
    tasks: remainingTasks,
    columns: {
      ...state.columns,
      [task.columnId]: {
        ...state.columns[task.columnId],
        taskIds: state.columns[task.columnId].taskIds.filter((id) => id !== taskId),
      },
    },
  };
}

export function applyMoveTask(
  state: BoardData,
  taskId: string,
  sourceColumnId: string,
  destColumnId: string,
  destIndex: number
): BoardData {
  const sourceColumn = state.columns[sourceColumnId];
  const destColumn = state.columns[destColumnId];
  if (!sourceColumn || !destColumn || !state.tasks[taskId]) return state;

  const sourceTaskIds = sourceColumn.taskIds.filter((id) => id !== taskId);
  const destTaskIds = sourceColumnId === destColumnId ? sourceTaskIds : [...destColumn.taskIds];
  destTaskIds.splice(destIndex, 0, taskId);

  return {
    tasks: { ...state.tasks, [taskId]: { ...state.tasks[taskId], columnId: destColumnId } },
    columns: {
      ...state.columns,
      [sourceColumnId]: { ...sourceColumn, taskIds: sourceTaskIds },
      [destColumnId]: { ...destColumn, taskIds: destTaskIds },
    },
  };
}
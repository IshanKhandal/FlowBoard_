import { describe, it, expect } from "vitest";
import { applyAddTask, applyUpdateTask, applyDeleteTask, applyMoveTask } from "./boardLogic";
import type { BoardData } from "./boardLogic";

function freshBoard(): BoardData {
  return {
    tasks: {},
    columns: {
      "col-todo": { id: "col-todo", title: "To Do", taskIds: [] },
      "col-progress": { id: "col-progress", title: "In Progress", taskIds: [] },
      "col-done": { id: "col-done", title: "Done", taskIds: [] },
    },
  };
}

describe("applyAddTask", () => {
  it("adds a new task to the correct column", () => {
    const board = freshBoard();
    const result = applyAddTask(board, "task-1", "col-todo", "Write tests", "", "medium");

    expect(result.tasks["task-1"]).toBeDefined();
    expect(result.columns["col-todo"].taskIds).toContain("task-1");
  });

  it("stores the correct title, description, and priority", () => {
    const board = freshBoard();
    const result = applyAddTask(board, "task-1", "col-todo", "Ship it", "Final review", "high");

    expect(result.tasks["task-1"].title).toBe("Ship it");
    expect(result.tasks["task-1"].description).toBe("Final review");
    expect(result.tasks["task-1"].priority).toBe("high");
  });

  it("does not mutate the original board object", () => {
    const board = freshBoard();
    applyAddTask(board, "task-1", "col-todo", "New task", "", "medium");

    expect(board.tasks["task-1"]).toBeUndefined();
  });
});

describe("applyDeleteTask", () => {
  it("removes the task and updates the column", () => {
    let board = freshBoard();
    board = applyAddTask(board, "task-1", "col-todo", "Temporary", "", "low");

    const result = applyDeleteTask(board, "task-1");

    expect(result.tasks["task-1"]).toBeUndefined();
    expect(result.columns["col-todo"].taskIds).not.toContain("task-1");
  });

  it("returns the same state unchanged if the task does not exist", () => {
    const board = freshBoard();
    const result = applyDeleteTask(board, "nonexistent-id");

    expect(result).toEqual(board);
  });
});

describe("applyMoveTask", () => {
  it("moves a task from one column to another", () => {
    let board = freshBoard();
    board = applyAddTask(board, "task-1", "col-todo", "Move me", "", "medium");

    const result = applyMoveTask(board, "task-1", "col-todo", "col-done", 0);

    expect(result.columns["col-todo"].taskIds).not.toContain("task-1");
    expect(result.columns["col-done"].taskIds).toContain("task-1");
  });

  it("updates the task's own columnId field, not just the column arrays", () => {
    let board = freshBoard();
    board = applyAddTask(board, "task-1", "col-todo", "Track me", "", "medium");

    const result = applyMoveTask(board, "task-1", "col-todo", "col-progress", 0);

    expect(result.tasks["task-1"].columnId).toBe("col-progress");
  });

  it("reorders tasks within the same column without losing any", () => {
    let board = freshBoard();
    board = applyAddTask(board, "task-A", "col-todo", "First", "", "medium");
    board = applyAddTask(board, "task-B", "col-todo", "Second", "", "medium");

    const result = applyMoveTask(board, "task-B", "col-todo", "col-todo", 0);

    expect(result.columns["col-todo"].taskIds).toEqual(["task-B", "task-A"]);
  });

  it("does nothing if the task or columns do not exist", () => {
    const board = freshBoard();
    const result = applyMoveTask(board, "ghost-task", "col-todo", "col-done", 0);

    expect(result).toEqual(board);
  });
});

describe("applyUpdateTask", () => {
  it("edits a task without affecting unrelated fields", () => {
    let board = freshBoard();
    board = applyAddTask(board, "task-1", "col-todo", "Original title", "Original desc", "low");

    const result = applyUpdateTask(board, "task-1", { title: "Updated title" });

    expect(result.tasks["task-1"].title).toBe("Updated title");
    expect(result.tasks["task-1"].description).toBe("Original desc");
    expect(result.tasks["task-1"].columnId).toBe("col-todo");
  });
});
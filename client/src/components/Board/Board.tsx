import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useBoardStore } from "../../store/boardStore";
import { Column } from "../Column/Column";
import { Card } from "../Card/Card";
import { TaskModal } from "../TaskModal/TaskModal";
import { ActivityPanel } from "../ActivityPanel/ActivityPanel";
import type { Task } from "../../types";
import "./Board.css";

type ModalState =
  | { mode: "closed" }
  | { mode: "create"; columnId: string }
  | { mode: "edit"; task: Task };

export function Board() {
  const {
    tasks,
    columns,
    columnOrder,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    connect,
    connected,
    onlineUsers,
    sendCursor,
    activityLog,
    comments,
    addComment,
  } = useBoardStore();

  useEffect(() => {
    connect();
  }, []);

  const [cursors, setCursors] = useState<Record<string, { x: number; y: number; name: string; color: string }>>({});

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      sendCursor(e.clientX, e.clientY);
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [sendCursor]);

  useEffect(() => {
    function handleRemoteCursor(e: Event) {
      const detail = (e as CustomEvent).detail;
      setCursors((prev) => ({
        ...prev,
        [detail.userId]: { x: detail.x, y: detail.y, name: detail.name, color: detail.color },
      }));
    }
    window.addEventListener("remote-cursor", handleRemoteCursor);
    return () => window.removeEventListener("remote-cursor", handleRemoteCursor);
  }, []);

  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function findColumnIdForTask(taskId: string): string | undefined {
    return Object.values(columns).find((col) => col.taskIds.includes(taskId))?.id;
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks[event.active.id as string];
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const sourceColumnId = findColumnIdForTask(activeId);
    const destColumnId = columns[overId] ? overId : findColumnIdForTask(overId);

    if (!sourceColumnId || !destColumnId || sourceColumnId === destColumnId) return;

    const destIndex = columns[destColumnId].taskIds.indexOf(overId);
    moveTask(activeId, sourceColumnId, destColumnId, destIndex === -1 ? 0 : destIndex);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceColumnId = findColumnIdForTask(activeId);
    const destColumnId = columns[overId] ? overId : findColumnIdForTask(overId);

    if (!sourceColumnId || !destColumnId) return;

    if (sourceColumnId === destColumnId && activeId !== overId) {
      const destIndex = columns[destColumnId].taskIds.indexOf(overId);
      moveTask(activeId, sourceColumnId, destColumnId, destIndex);
    }
  }

  function handleSaveTask(data: { title: string; description: string; priority: Task["priority"] }) {
    if (modal.mode === "create") {
      addTask(modal.columnId, data.title, data.description, data.priority);
    } else if (modal.mode === "edit") {
      updateTask(modal.task.id, data);
    }
    setModal({ mode: "closed" });
  }

  return (
    <div className="board-page">
      <header className="board-header">
        <h1 className="board-logo">FlowBoard</h1>
        <span className="board-tagline">A focused space for getting things done</span>
        <div className="presence-bar">
          <span className={`presence-dot ${connected ? "presence-dot-online" : "presence-dot-offline"}`} />
          <span className="presence-label">{connected ? "Live" : "Connecting..."}</span>
          <div className="presence-avatars">
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                className="presence-avatar"
                style={{ background: user.color }}
                title={user.name}
              >
                {user.name.charAt(0)}
              </div>
            ))}
          </div>
          <button className="activity-toggle" onClick={() => setActivityOpen(true)}>
            Activity
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="board-columns">
          {columnOrder.map((columnId) => {
            const column = columns[columnId];
            const columnTasks = column.taskIds.map((id) => tasks[id]).filter(Boolean);
            return (
              <Column
                key={columnId}
                column={column}
                tasks={columnTasks}
                onAddTask={(id) => setModal({ mode: "create", columnId: id })}
                onEditTask={(task) => setModal({ mode: "edit", task })}
                onDeleteTask={deleteTask}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <Card task={activeTask} onEdit={() => {}} onDelete={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {modal.mode !== "closed" && (
        <TaskModal
          mode={modal.mode}
          initialTask={modal.mode === "edit" ? modal.task : undefined}
          onSave={handleSaveTask}
          onClose={() => setModal({ mode: "closed" })}
          comments={modal.mode === "edit" ? comments[modal.task.id] ?? [] : []}
          onAddComment={(text) => {
            if (modal.mode === "edit") addComment(modal.task.id, text);
          }}
        />
      )}

      <ActivityPanel
        isOpen={activityOpen}
        onClose={() => setActivityOpen(false)}
        activityLog={activityLog}
      />

      {Object.entries(cursors).map(([userId, cursor]) => (
        <div
          key={userId}
          className="remote-cursor"
          style={{ left: cursor.x, top: cursor.y, "--cursor-color": cursor.color } as React.CSSProperties}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill={cursor.color}>
            <path d="M2 2L18 9L11 11L9 18L2 2Z" />
          </svg>
          <span className="remote-cursor-label" style={{ background: cursor.color }}>
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}
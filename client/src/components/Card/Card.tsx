import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../../types";
import "./Card.css";

interface CardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const priorityLabel: Record<Task["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * useSortable (from @dnd-kit/sortable) gives us the drag handle props,
 * the live transform while dragging, and an `isDragging` flag — all
 * without us writing any mouse/touch event handling ourselves. dnd-kit
 * was chosen over react-dnd because it has first-class keyboard and
 * touch support out of the box, which matters for accessibility and
 * for this app actually working on mobile.
 */
export function Card({ task, onEdit, onDelete }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card priority-${task.priority} ${isDragging ? "card-dragging" : ""}`}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
    >
      <div className="card-header">
        <span className={`priority-pill priority-pill-${task.priority}`}>
          {priorityLabel[task.priority]}
        </span>
        <button
          className="card-delete"
          aria-label={`Delete task: ${task.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
        >
          ×
        </button>
      </div>
      <h3 className="card-title">{task.title}</h3>
      {task.description && <p className="card-description">{task.description}</p>}
    </div>
  );
}
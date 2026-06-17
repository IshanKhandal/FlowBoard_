import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Column as ColumnType, Task } from "../../types";
import { Card } from "../Card/Card";
import "./Column.css";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export function Column({ column, tasks, onAddTask, onEditTask, onDeleteTask }: ColumnProps) {
  // useDroppable marks this column's body as a valid place to drop a
  // card, even when the column is empty (an empty SortableContext alone
  // wouldn't register as a drop target — this is what makes dragging a
  // card into an empty "Done" column work correctly).
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column" },
  });

  return (
    <div className="column">
      <div className="column-header">
        <h2 className="column-title">{column.title}</h2>
        <span className="column-count">{tasks.length}</span>
      </div>

      <div ref={setNodeRef} className={`column-body ${isOver ? "column-body-over" : ""}`}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <Card key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="column-empty">Drop a task here, or add one below.</div>
        )}
      </div>

      <button className="column-add" onClick={() => onAddTask(column.id)}>
        + Add task
      </button>
    </div>
  );
}
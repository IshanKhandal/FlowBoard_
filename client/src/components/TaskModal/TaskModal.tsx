import { useEffect, useState } from "react";
import type { Priority, Task } from "../../types";
import "./TaskModal.css";

interface Comment {
  id: string;
  taskId: string;
  authorName: string;
  authorColor: string;
  text: string;
  timestamp: number;
}

interface TaskModalProps {
  mode: "create" | "edit";
  initialTask?: Task;
  onSave: (data: { title: string; description: string; priority: Priority }) => void;
  onClose: () => void;
  comments: Comment[];
  onAddComment: (text: string) => void;
}

interface FormErrors {
  title?: string;
}

const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 280;

function validate(title: string): FormErrors {
  const errors: FormErrors = {};
  if (title.trim().length === 0) {
    errors.title = "Title is required.";
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`;
  }
  return errors;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function TaskModal({ mode, initialTask, onSave, onClose, comments, onAddComment }: TaskModalProps) {
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [priority, setPriority] = useState<Priority>(initialTask?.priority ?? "medium");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (touched) {
      setErrors(validate(title));
    }
  }, [title, touched]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const validationErrors = validate(title);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      onSave({ title: title.trim(), description: description.trim(), priority });
    }
  }

  function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (commentText.trim().length === 0) return;
    onAddComment(commentText.trim());
    setCommentText("");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="modal-heading">
          {mode === "create" ? "New task" : "Edit task"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              maxLength={TITLE_MAX_LENGTH}
              autoFocus
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : undefined}
              className={errors.title ? "input-error" : ""}
            />
            {errors.title && (
              <span id="title-error" className="field-error" role="alert">
                {errors.title}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="task-description">Description</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail (optional)"
              maxLength={DESCRIPTION_MAX_LENGTH}
              rows={3}
            />
            <span className="field-hint">
              {description.length}/{DESCRIPTION_MAX_LENGTH}
            </span>
          </div>

          <div className="form-field">
            <label>Priority</label>
            <div className="priority-selector">
              {(["low", "medium", "high"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`priority-option priority-option-${p} ${
                    priority === p ? "priority-option-active" : ""
                  }`}
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {mode === "create" ? "Create task" : "Save changes"}
            </button>
          </div>
        </form>

        {mode === "edit" && (
          <div className="comments-section">
            <h3 className="comments-heading">Comments</h3>
            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="comments-empty">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="comment-entry">
                    <div className="comment-avatar" style={{ background: c.authorColor }}>
                      {c.authorName.charAt(0)}
                    </div>
                    <div className="comment-body">
                      <div className="comment-header">
                        <span className="comment-author">{c.authorName}</span>
                        <span className="comment-time">{timeAgo(c.timestamp)}</span>
                      </div>
                      <p className="comment-text">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="comment-form" onSubmit={handleCommentSubmit}>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                maxLength={200}
              />
              <button type="submit" className="btn-comment-send">
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
import "./ActivityPanel.css";

interface ActivityEntry {
  id: string;
  message: string;
  timestamp: number;
}

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activityLog: ActivityEntry[];
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityPanel({ isOpen, onClose, activityLog }: ActivityPanelProps) {
  return (
    <>
      {isOpen && <div className="activity-overlay" onClick={onClose} />}
      <aside className={`activity-panel ${isOpen ? "activity-panel-open" : ""}`}>
        <div className="activity-panel-header">
          <h2>Activity</h2>
          <button className="activity-panel-close" onClick={onClose} aria-label="Close activity panel">
            ×
          </button>
        </div>
        <div className="activity-panel-body">
          {activityLog.length === 0 ? (
            <p className="activity-empty">No activity yet. Actions will appear here in real time.</p>
          ) : (
            activityLog.map((entry) => (
              <div key={entry.id} className="activity-entry">
                <span className="activity-dot" />
                <div className="activity-content">
                  <p className="activity-message">{entry.message}</p>
                  <span className="activity-time">{timeAgo(entry.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
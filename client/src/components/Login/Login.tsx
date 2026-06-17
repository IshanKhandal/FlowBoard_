import { useState } from "react";
import "./Login.css";

interface LoginProps {
  onGuestLogin: (name: string) => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export function Login({ onGuestLogin }: LoginProps) {
  const [guestName, setGuestName] = useState("");

  function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = guestName.trim();
    if (trimmed.length === 0) return;
    onGuestLogin(trimmed);
  }

  function handleGitHubLogin() {
    window.location.href = `${BACKEND_URL}/auth/github`;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-logo">FlowBoard</h1>
        <p className="login-tagline">A focused space for getting things done, together.</p>

        <button className="login-github-btn" onClick={handleGitHubLogin}>
          Sign in with GitHub
        </button>

        <div className="login-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleGuestSubmit} className="login-guest-form">
          <input
            type="text"
            placeholder="Enter a display name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            maxLength={24}
          />
          <button type="submit" className="login-guest-btn">
            Continue as guest
          </button>
        </form>
      </div>
    </div>
  );
}
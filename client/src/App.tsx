import { useEffect, useState } from "react";
import { Board } from "./components/Board/Board";
import { Login } from "./components/Login/Login";
import { useBoardStore } from "./store/boardStore";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const connect = useBoardStore((s) => s.connect);

  useEffect(() => {
    fetch(`${BACKEND_URL}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setIsAuthed(true);
          connect();
        }
        setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));
  }, [connect]);

  function handleGuestLogin(name: string) {
    setIsAuthed(true);
    connect(name);
  }

  if (checkingSession) {
    return null;
  }

  if (!isAuthed) {
    return <Login onGuestLogin={handleGuestLogin} />;
  }

  return <Board />;
}

export default App;
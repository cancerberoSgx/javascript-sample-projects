import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface BackendInfo {
  port: number;
  token: string;
}

interface HealthResponse {
  success: boolean;
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const info = await invoke<BackendInfo>("get_backend_info");
        const res = await fetch(`http://127.0.0.1:${info.port}/api/health`, {
          headers: { "x-session-token": info.token },
        });
        const data: HealthResponse = await res.json();
        setHealth(data);
      } catch (e) {
        setError(String(e));
      }
    }
    checkHealth();
  }, []);

  return (
    <main className="container">
      <h1>SQL Inspector</h1>
      <section>
        <h2>Backend health</h2>
        {!health && !error && <p>Checking...</p>}
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
        {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
      </section>
    </main>
  );
}

export default App;

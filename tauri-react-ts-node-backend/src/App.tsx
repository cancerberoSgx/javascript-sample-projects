import { useState, useEffect } from "react";
import { getBackendInfo, apiUrl, authHeaders } from "./lib/backend";
import "./App.css";

interface HealthResponse {
  success: boolean;
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const info = await getBackendInfo();

        const res = await fetch(apiUrl("/api/health", info), {
          headers: authHeaders(info),
        });
        const data: HealthResponse = await res.json();
        setHealth(data);
      } catch (e) {
        setError(String(e));
      }
    }
    init();
  }, []);

  return (
    <main className="container">
      <h1>SQL Inspector</h1>
      <section>
        <h2>Backend health</h2>
        {!health && !error && <p>Checking...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
      </section>
    </main>
  );
}

export default App;

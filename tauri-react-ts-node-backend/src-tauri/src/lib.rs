use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};

struct NodeBackend {
    port: u16,
    token: String,
    child: Child,
}

impl Drop for NodeBackend {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

struct AppState {
    backend: Mutex<Option<NodeBackend>>,
}

#[derive(serde::Serialize)]
struct BackendInfo {
    port: u16,
    token: String,
}

#[tauri::command]
fn get_backend_info(state: State<AppState>) -> Result<BackendInfo, String> {
    let guard = state.backend.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(b) => Ok(BackendInfo {
            port: b.port,
            token: b.token.clone(),
        }),
        None => Err("Node backend is not running".to_string()),
    }
}

fn start_node_backend() -> Result<NodeBackend, String> {
    let node_backend_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("Cannot resolve project root")?
        .join("node-backend");

    if !node_backend_path.join("node_modules").exists() {
        eprintln!("[tauri] Running npm install in node-backend...");
        let status = Command::new("npm")
            .arg("install")
            .current_dir(&node_backend_path)
            .status()
            .map_err(|e| format!("Failed to run npm install: {e}"))?;
        if !status.success() {
            return Err("npm install failed".to_string());
        }
    }

    #[cfg(windows)]
    let tsx = node_backend_path
        .join("node_modules")
        .join(".bin")
        .join("tsx.cmd");
    #[cfg(not(windows))]
    let tsx = node_backend_path
        .join("node_modules")
        .join(".bin")
        .join("tsx");

    let mut child = Command::new(&tsx)
        .arg("src/server.ts")
        .current_dir(&node_backend_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("Failed to spawn node backend: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture node backend stdout")?;

    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    let mut port: Option<u16> = None;
    let mut token: Option<String> = None;

    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("READY:") {
                    // Format: READY:{port}:{token}
                    if let Some((port_str, tok)) = rest.split_once(':') {
                        port = port_str.parse::<u16>().ok();
                        token = Some(tok.to_string());
                    }
                    break;
                }
            }
            Err(e) => return Err(format!("Error reading node backend output: {e}")),
        }
    }

    // Drain remaining stdout so the pipe never blocks the node process
    std::thread::spawn(move || {
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => print!("[node] {}", line),
            }
        }
    });

    let port = port.ok_or("Node backend did not send a valid port")?;
    let token = token.ok_or("Node backend did not send a session token")?;

    Ok(NodeBackend { port, token, child })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let backend_result = start_node_backend();
            match backend_result {
                Ok(backend) => {
                    app.manage(AppState {
                        backend: Mutex::new(Some(backend)),
                    });
                }
                Err(e) => {
                    eprintln!("[tauri] Failed to start node backend: {e}");
                    app.manage(AppState {
                        backend: Mutex::new(None),
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

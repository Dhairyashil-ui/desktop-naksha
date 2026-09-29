// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};

struct BackendProcessState {
    child: Mutex<Option<Child>>,
    port: u16,
}

/// Native folder selector using Tauri's native dialog API
#[tauri::command]
async fn select_project_folder() -> Result<Option<String>, String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;
    let folder = FileDialogBuilder::new().pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

/// Real backend health check — queries FastAPI /health directly.
/// NO FAKE DATA: Returns actual status from the running HTTP service.
#[tauri::command]
async fn get_backend_status(state: State<'_, BackendProcessState>) -> Result<serde_json::Value, String> {
    let port = state.port;
    let url = format!("http://127.0.0.1:{}/health", port);

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(1500))
        .build()
    {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to build HTTP client: {}", e)),
    };

    match client.get(&url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(mut body) => {
                        body["apiPort"] = serde_json::json!(port);
                        body["healthy"] = serde_json::json!(true);
                        Ok(body)
                    }
                    Err(e) => Err(format!("Failed to parse JSON from backend: {}", e)),
                }
            } else {
                Ok(serde_json::json!({
                    "status": "DEGRADED",
                    "apiPort": port,
                    "healthy": false,
                    "httpStatus": resp.status().as_u16()
                }))
            }
        }
        Err(e) => {
            Ok(serde_json::json!({
                "status": "OFFLINE",
                "apiPort": port,
                "healthy": false,
                "error": e.to_string()
            }))
        }
    }
}

/// Checks if an HTTP endpoint responds with 200 OK
fn is_backend_healthy(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{}/health", port);
    if let Ok(client) = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(400))
        .build()
    {
        if let Ok(resp) = client.get(&url).send() {
            return resp.status().is_success();
        }
    }
    false
}

/// Spawns the Python FastAPI backend process if not already running.
/// Ensures correct working directory so imports and paths resolve properly.
fn spawn_python_backend(port: u16) -> Option<Child> {
    println!("[TAURI-RUST] Verifying Python FastAPI backend on port {}...", port);

    // 1. Check if backend is already listening and responsive
    if is_backend_healthy(port) {
        println!("[TAURI-RUST] Backend is already running and healthy on http://127.0.0.1:{} (attaching to existing service).", port);
        return None;
    }

    // 2. Discover project root containing backend/main.py
    let current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let candidates = [
        current.clone(),
        current.join(".."),
        PathBuf::from("D:/surveynaksha"),
        PathBuf::from("."),
    ];

    let mut project_root: Option<PathBuf> = None;
    for cand in &candidates {
        if cand.join("backend").join("main.py").exists() {
            let p_str = cand.to_string_lossy().replace(r"\\?\", "");
            project_root = Some(PathBuf::from(p_str));
            break;
        }
    }

    let root = match project_root {
        Some(r) => r,
        None => {
            eprintln!("[TAURI-RUST] Warning: Could not locate backend/main.py. Backend must be started manually.");
            return None;
        }
    };

    println!("[TAURI-RUST] Launching FastAPI backend from root: {:?}", root);

    // 3. Spawn Python uvicorn server
    let python_execs = ["python", "python3", "py"];
    let mut spawned_child = None;

    for py in python_execs {
        let result = Command::new(py)
            .args(["-m", "uvicorn", "backend.main:app", "--port", &port.to_string(), "--host", "127.0.0.1"])
            .current_dir(&root)
            .spawn();

        match result {
            Ok(child) => {
                println!("[TAURI-RUST] Python backend process spawned (PID: {}) using '{}'", child.id(), py);
                spawned_child = Some(child);
                break;
            }
            Err(_) => continue,
        }
    }

    if spawned_child.is_none() {
        eprintln!("[TAURI-RUST] Error: Failed to execute python. Please ensure Python is installed and in PATH.");
        return None;
    }

    // 4. Wait for backend to report ready (up to 15 seconds)
    println!("[TAURI-RUST] Waiting for backend to become healthy...");
    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(15);
    while start.elapsed() < timeout {
        if is_backend_healthy(port) {
            println!("[TAURI-RUST] FastAPI backend confirmed healthy on http://127.0.0.1:{}", port);
            return spawned_child;
        }
        std::thread::sleep(Duration::from_millis(300));
    }

    println!("[TAURI-RUST] Warning: Backend startup exceeded timeout. Continuing startup.");
    spawned_child
}

/// Gracefully terminates the backend process and any spawned children
fn terminate_backend(child_opt: &mut Option<Child>) {
    if let Some(child) = child_opt.take() {
        let pid = child.id();
        println!("[TAURI-RUST] Gracefully shutting down backend process (PID: {})...", pid);

        #[cfg(windows)]
        {
            let _ = Command::new("C:\\Windows\\System32\\taskkill.exe")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .status();
        }

        #[cfg(not(windows))]
        {
            let _ = child.kill();
        }

        println!("[TAURI-RUST] Backend shutdown complete.");
    }
}

fn main() {
    let port: u16 = 8000;
    let backend_child = spawn_python_backend(port);

    tauri::Builder::default()
        .manage(BackendProcessState {
            child: Mutex::new(backend_child),
            port,
        })
        .invoke_handler(tauri::generate_handler![
            select_project_folder,
            get_backend_status
        ])
        .on_window_event(|event| {
            match event.event() {
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                    println!("[TAURI-RUST] Window closing. Cleaning up sidecar processes...");
                    let state: State<BackendProcessState> = event.window().state();
                    if let Ok(mut lock) = state.child.lock() {
                        terminate_backend(&mut lock);
                    };
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("Error while building Naksha 2.0 Tauri desktop application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                println!("[TAURI-RUST] Exit requested. Ensuring backend shutdown...");
                let state: State<BackendProcessState> = app_handle.state();
                if let Ok(mut lock) = state.child.lock() {
                    terminate_backend(&mut lock);
                };
            }
        });
}

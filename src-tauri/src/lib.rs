mod binaries;
use tauri::{Manager, Emitter};

#[tauri::command]
fn get_bin_path() -> String {
    binaries::get_bin_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn check_binary(name: String) -> bool {
    binaries::check_binary_exists(&name)
}

#[tauri::command]
async fn download_binary(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let _ = app.emit("download-log", format!("Iniciando processo para: {}", name));
    
    if name == "yt-dlp" {
        let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        let _ = app.emit("download-log", format!("URL: {}", url));
        let result = binaries::download_yt_dlp().await;
        match result {
            Ok(_) => {
                let _ = app.emit("download-log", "yt-dlp instalado com sucesso!".to_string());
                Ok(())
            },
            Err(e) => {
                let _ = app.emit("download-log", format!("Erro no yt-dlp: {}", e));
                Err(e)
            }
        }
    } else if name == "ffmpeg" {
        let url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
        let _ = app.emit("download-log", format!("URL: {}", url));
        let _ = app.emit("download-log", "Baixando release essentials do FFmpeg...".to_string());
        let result = binaries::download_ffmpeg().await;
        match result {
            Ok(_) => {
                let _ = app.emit("download-log", "FFmpeg extraído e configurado!".to_string());
                Ok(())
            },
            Err(e) => {
                let _ = app.emit("download-log", format!("Erro no FFmpeg: {}", e));
                Err(e)
            }
        }
    } else {
        Err("Binary not supported".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .setup(|app| {
        let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
        let show_i = tauri::menu::MenuItem::with_id(app, "show", "Abrir App", true, None::<&str>)?;
        let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

        if let Some(icon) = app.default_window_icon() {
            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .icon(icon.clone())
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            let _ = toggle_window(app);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { 
                        button: tauri::tray::MouseButton::Left, 
                        button_state: tauri::tray::MouseButtonState::Up,
                        .. 
                    } = event {
                        let _ = toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;
        }

        if let Some(window) = app.get_webview_window("main") {
            // Apply Mica effect (Windows 11)
            #[cfg(target_os = "windows")]
            {
                let _ = window_vibrancy::apply_mica(&window, None);
            }
        }

        Ok(())
    })
    .on_window_event(|window, event| {
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        }
    })
    .invoke_handler(tauri::generate_handler![check_binary, download_binary, get_bin_path])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn toggle_window(app: &tauri::AppHandle) -> Result<(), tauri::Error> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible()? {
            window.hide()?;
        } else {
            if let Some(monitor) = window.current_monitor()? {
                let size = window.outer_size()?;
                let scale_factor = monitor.scale_factor();
                
                // Get the work area (excludes taskbar)
                let work_area = monitor.work_area();
                let monitor_pos = monitor.position();

                // Calculate logical units for tauri::Position::Logical
                // We want it at the bottom right of the work area
                let x = (monitor_pos.x as f64 + work_area.size.width as f64 - size.width as f64) / scale_factor - 10.0;
                let y = (monitor_pos.y as f64 + work_area.size.height as f64 - size.height as f64) / scale_factor - 10.0;
                
                window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))?;
                window.show()?;
                window.set_focus()?;
            }
        }
    }
    Ok(())
}

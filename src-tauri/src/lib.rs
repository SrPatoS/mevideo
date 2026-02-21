mod binaries;
use tauri::Manager;

#[tauri::command]
fn check_binary(name: String) -> bool {
    binaries::check_binary_exists(&name)
}

#[tauri::command]
async fn download_binary(name: String) -> Result<(), String> {
    if name == "yt-dlp" {
        binaries::download_yt_dlp().await
    } else if name == "ffmpeg" {
        binaries::download_ffmpeg().await
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
    .invoke_handler(tauri::generate_handler![check_binary, download_binary])
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

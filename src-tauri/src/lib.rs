use tauri::Manager;
use tauri::Emitter;

mod binaries;

fn position_window_bottom_right(window: &tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let monitor_size = monitor.size();
        let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize { width: 380, height: 550 });
        let margin_right: i32 = 12;
        let margin_bottom: i32 = 48;
        let x = (monitor_size.width as i32) - (win_size.width as i32) - margin_right;
        let y = (monitor_size.height as i32) - (win_size.height as i32) - margin_bottom;
        let _ = window.set_position(tauri::PhysicalPosition { x, y });
    }
}

fn toggle_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Janela não encontrada")?;
    if window.is_visible().unwrap_or(false) {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        position_window_bottom_right(&window);
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_bin_path() -> String {
    binaries::get_bin_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn open_bin_dir() {
    let path = binaries::get_bin_dir();
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(path)
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(path)
            .spawn();
    }
}

#[tauri::command]
fn check_binary(name: String) -> bool {
    binaries::check_binary_exists(&name)
}

#[tauri::command]
async fn download_binary(app: tauri::AppHandle, name: String, lang: String) -> Result<(), String> {
    let msg_start = if lang == "en" { "Starting process for:" } else if lang == "es" { "Iniciando proceso para:" } else { "Iniciando processo para:" };
    let msg_ffmpeg = if lang == "en" { "Downloading release for your OS..." } else if lang == "es" { "Descargando release para su OS..." } else { "Baixando release para seu OS..." };
    let msg_success = if lang == "en" { "successfully installed!" } else if lang == "es" { "instalado con éxito!" } else { "instalado com sucesso!" };
    let msg_ffmpeg_success = if lang == "en" { "FFmpeg extracted and configured!" } else if lang == "es" { "¡FFmpeg extraído y configurado!" } else { "FFmpeg extraído e configurado!" };

    let _ = app.emit("download-log", format!("{} {}", msg_start, name));

    if name == "yt-dlp" {
        let result = binaries::download_yt_dlp().await;
        match result {
            Ok(_) => {
                let _ = app.emit("download-log", format!("yt-dlp {}", msg_success));
                Ok(())
            }
            Err(e) => {
                let _ = app.emit("download-log", format!("Error: {}", e));
                Err(e)
            }
        }
    } else if name == "ffmpeg" {
        let _ = app.emit("download-log", msg_ffmpeg.to_string());
        let result = binaries::download_ffmpeg().await;
        match result {
            Ok(_) => {
                let _ = app.emit("download-log", msg_ffmpeg_success.to_string());
                Ok(())
            }
            Err(e) => {
                let _ = app.emit("download-log", format!("Error: {}", e));
                Err(e)
            }
        }
    } else {
        Err("Binary not supported".to_string())
    }
}

#[derive(serde::Serialize)]
struct VideoInfo {
    title: String,
    thumbnail: String,
    formats: Vec<FormatInfo>,
}

#[derive(serde::Serialize)]
struct FormatInfo {
    format_id: String,
    ext: String,
    resolution: String,
    height: u64,
    filesize: Option<u64>,
    vcodec: String,
}

#[tauri::command]
async fn get_video_info(url: String) -> Result<VideoInfo, String> {
    let bin_dir = binaries::get_bin_dir();
    let yt_dlp_path = if cfg!(target_os = "windows") {
        bin_dir.join("yt-dlp.exe")
    } else {
        bin_dir.join("yt-dlp")
    };

    if !yt_dlp_path.exists() {
        return Err("yt-dlp not installed".to_string());
    }

    let mut cmd = std::process::Command::new(&yt_dlp_path);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd
        .arg("-j")
        .arg("--no-playlist")
        .arg(&url)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;

    let title = json["title"].as_str().unwrap_or("Unknown").to_string();
    let thumbnail = json["thumbnail"].as_str().unwrap_or("").to_string();

    let mut formats = Vec::new();
    if let Some(formats_array) = json["formats"].as_array() {
        for f in formats_array {
            let vcodec = f["vcodec"].as_str().unwrap_or("none");
            if vcodec == "none" { continue; }

            let resolution = f["resolution"].as_str().unwrap_or("?").to_string();
            let height = f["height"].as_u64().unwrap_or(0);

            formats.push(FormatInfo {
                format_id: f["format_id"].as_str().unwrap_or("").to_string(),
                ext: f["ext"].as_str().unwrap_or("").to_string(),
                resolution,
                height,
                filesize: f["filesize"].as_u64().or_else(|| f["filesize_approx"].as_u64()),
                vcodec: vcodec.to_string(),
            });
        }
    }

    // Sort: highest resolution first, mp4 before others at same height
    formats.sort_by(|a, b| {
        b.height.cmp(&a.height)
            .then_with(|| {
                let a_mp4 = if a.ext == "mp4" { 0 } else { 1 };
                let b_mp4 = if b.ext == "mp4" { 0 } else { 1 };
                a_mp4.cmp(&b_mp4)
            })
    });

    Ok(VideoInfo { title, thumbnail, formats })
}

#[tauri::command]
async fn download_video(
    app: tauri::AppHandle,
    url: String,
    format_id: String,
    format_ext: String,
    format_height: u64,
    custom_path: Option<String>,
) -> Result<String, String> {
    let bin_dir = binaries::get_bin_dir();
    let yt_dlp_path = if cfg!(target_os = "windows") {
        bin_dir.join("yt-dlp.exe")
    } else {
        bin_dir.join("yt-dlp")
    };
    let ffmpeg_path = if cfg!(target_os = "windows") {
        bin_dir.join("ffmpeg.exe")
    } else {
        bin_dir.join("ffmpeg")
    };

    if !yt_dlp_path.exists() {
        return Err("yt-dlp not installed".to_string());
    }

    let dest_path = if let Some(p) = custom_path {
        std::path::PathBuf::from(p)
    } else {
        app.path()
            .resolve("", tauri::path::BaseDirectory::Download)
            .map_err(|e| e.to_string())?
    };

    // Build a robust format string using quality-based selection (always respected by yt-dlp)
    // with the original format_id as fallback.
    let video_sel = if format_height > 0 {
        format!("bestvideo[height={}][ext={}]", format_height, format_ext)
    } else {
        format_id.clone()
    };
    let audio_sel = if format_ext == "mp4" {
        "bestaudio[ext=m4a]/bestaudio"
    } else if format_ext == "webm" {
        "bestaudio[ext=webm]/bestaudio"
    } else {
        "bestaudio"
    };
    // e.g. "bestvideo[height=720][ext=mp4]+bestaudio[ext=m4a]/bestaudio/137+bestaudio[ext=m4a]/bestaudio/137+bestaudio"
    let format_str = format!(
        "{video}+{audio}/{fid}+{audio}/{fid}+bestaudio",
        video = video_sel,
        audio = audio_sel,
        fid = format_id
    );

    let _ = app.emit(
        "download-log",
        format!("Baixando {}p {} — seletor: {}", format_height, format_ext.to_uppercase(), video_sel),
    );

    let mut cmd = std::process::Command::new(&yt_dlp_path);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    
    cmd.arg("--ffmpeg-location")
        .arg(&ffmpeg_path)
        .arg("-f")
        .arg(&format_str)
        .arg("--merge-output-format")
        .arg(&format_ext)
        .arg("-o")
        .arg(format!("{}/%(title)s.%(ext)s", dest_path.to_string_lossy()))
        .arg(&url)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let reader = std::io::BufReader::new(stdout);

    use std::io::BufRead;
    for line in reader.lines() {
        if let Ok(l) = line {
            let _ = app.emit("download-log", l);
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        let _ = app.emit("download-log", "✅ Download concluído!".to_string());
        Ok(dest_path.to_string_lossy().to_string())
    } else {
        Err("Processo do yt-dlp falhou".to_string())
    }
}

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder);
    });
    let folder = rx.await.map_err(|e| e.to_string())?;
    Ok(folder.map(|f| f.to_string()))
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let quit_i =
                tauri::menu::MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let show_i =
                tauri::menu::MenuItem::with_id(app, "show", "Abrir App", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = tauri::tray::TrayIconBuilder::new()
                    .menu(&menu)
                    .icon(icon.clone())
                    .on_menu_event(move |app, event| match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            let _ = toggle_window(app);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let _ = toggle_window(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                {
                    let _ = window_vibrancy::apply_mica(&window, None);
                }
                position_window_bottom_right(&window);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            check_binary,
            download_binary,
            get_bin_path,
            open_bin_dir,
            download_video,
            get_video_info,
            pick_folder,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

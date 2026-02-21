use std::path::PathBuf;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use reqwest;
use futures_util::StreamExt;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use directories::ProjectDirs;

pub fn get_bin_dir() -> PathBuf {
    let proj_dirs = ProjectDirs::from("com", "metool", "app").unwrap();
    let bin_dir = proj_dirs.data_dir().join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).unwrap();
    }
    bin_dir
}

pub fn check_binary_exists(name: &str) -> bool {
    let bin_dir = get_bin_dir();
    let ext = if cfg!(windows) { ".exe" } else { "" };
    let path = bin_dir.join(format!("{}{}", name, ext));
    path.exists()
}

pub async fn download_yt_dlp() -> Result<(), String> {
    let bin_dir = get_bin_dir();
    fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;

    let file_name = if cfg!(target_os = "windows") { "yt-dlp.exe" } else { "yt-dlp" };
    let url = if cfg!(target_os = "windows") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    };

    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let mut file = File::create(bin_dir.join(file_name)).await.map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    #[cfg(unix)]
    {
        let mut perms = fs::metadata(bin_dir.join(file_name)).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(bin_dir.join(file_name), perms).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub async fn download_ffmpeg() -> Result<(), String> {
    let bin_dir = get_bin_dir();
    fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;

    let url = if cfg!(target_os = "windows") {
        "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    } else {
        // Static build for Linux x86_64
        "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
    };

    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let fname = if cfg!(target_os = "windows") { "ffmpeg.zip" } else { "ffmpeg.tar.xz" };
    let temp_file = bin_dir.join(fname);
    let mut file = File::create(&temp_file).await.map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    if cfg!(target_os = "windows") {
        // Windows ZIP extraction logic (existing)
        let file = std::fs::File::open(&temp_file).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            if file.name().ends_with("ffmpeg.exe") {
                let outpath = bin_dir.join("ffmpeg.exe");
                let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                break;
            }
        }
    } else {
        // Linux TAR.XZ extraction
        // For simplicity and to avoid many dependencies, we can use a command or a specialized crate
        // johnvansickle tarballs usually have a subfolder. Using 'tar' command is often safest on Linux.
        let output = std::process::Command::new("tar")
            .arg("-xf")
            .arg(&temp_file)
            .arg("-C")
            .arg(&bin_dir)
            .arg("--strip-components=1")
            .output()
            .map_err(|e| format!("Failed to extract tar: {}", e))?;

        if !output.status.success() {
            return Err(format!("Tar extraction failed: {}", String::from_utf8_lossy(&output.stderr)));
        }
        
        // Ensure the binary is in the right place and called just 'ffmpeg'
        // The strip-components might put 'ffmpeg' directly in bin_dir if chosen correctly
    }

    let _ = fs::remove_file(temp_file);
    Ok(())
}

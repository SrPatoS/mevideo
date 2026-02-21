use std::path::PathBuf;
use std::fs;
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
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    let path = bin_dir.join("yt-dlp.exe");

    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let mut file = File::create(path).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub async fn download_ffmpeg() -> Result<(), String> {
    let bin_dir = get_bin_dir();
    let url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
    let temp_zip = bin_dir.join("ffmpeg.zip");

    // Download zip
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let mut file = File::create(&temp_zip).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    // Extract zip
    let zip_file = std::fs::File::open(&temp_zip).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        if outpath.file_name().and_then(|s| s.to_str()) == Some("ffmpeg.exe") {
            let mut outfile = std::fs::File::create(bin_dir.join("ffmpeg.exe")).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            break;
        }
    }

    // Cleanup
    let _ = fs::remove_file(temp_zip);

    Ok(())
}

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [status, setStatus] = useState<string>("Pronto");
  const [binaries, setBinaries] = useState<{ name: string; exists: boolean }[]>([
    { name: "yt-dlp", exists: false },
    { name: "ffmpeg", exists: false },
  ]);

  const checkBinaries = async () => {
    // We will implement these commands in Rust
    try {
      const ytdlpExists = await invoke("check_binary", { name: "yt-dlp" }) as boolean;
      const ffmpegExists = await invoke("check_binary", { name: "ffmpeg" }) as boolean;
      setBinaries([
        { name: "yt-dlp", exists: ytdlpExists },
        { name: "ffmpeg", exists: ffmpegExists },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkBinaries();
  }, []);

  const downloadBinary = async (name: string) => {
    setStatus(`Baixando ${name}...`);
    try {
      await invoke("download_binary", { name });
      setStatus(`${name} baixado com sucesso!`);
      checkBinaries();
    } catch (e) {
      setStatus(`Erro ao baixar ${name}: ${e}`);
    }
  };

  const hideWindow = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    } catch (e) {
      console.error(e);
    }
  };

  const minimizeWindow = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="glass">
      <header style={{ marginBottom: "30px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: "2rem", margin: "0" }}>MeTool</h1>
          <p style={{ opacity: 0.6, fontSize: "0.85rem" }}>Binários & Desktop Client</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={minimizeWindow} className="control-btn" title="Minimizar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button onClick={hideWindow} className="control-btn close" title="Esconder">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </header>

      <div style={{ textAlign: "left", flex: 1, overflowY: "auto" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "16px" }}>Ferramentas</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {binaries.map((bin) => (
            <div key={bin.name} className="binary-card" style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: "14px", 
              background: "rgba(255,255,255,0.02)", 
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.05)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ 
                  width: "8px", 
                  height: "8px", 
                  borderRadius: "50%", 
                  background: bin.exists ? "#4ade80" : "#f87171" 
                }} />
                <div>
                  <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>{bin.name}</div>
                </div>
              </div>
              <button onClick={() => downloadBinary(bin.name)} style={{ minWidth: "90px", fontSize: "0.85rem", padding: "6px 12px" }}>
                {bin.exists ? "Atualizar" : "Instalar"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "20px", padding: "12px", background: "rgba(99, 102, 241, 0.1)", borderRadius: "8px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
        <div style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#6366f1" }}>●</span>
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
}

export default App;

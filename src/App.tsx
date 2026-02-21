import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [status, setStatus] = useState<string>("Pronto");
  const [logs, setLogs] = useState<string[]>(["MeTool Initialized..."]);
  const [view, setView] = useState<"home" | "config">("home");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [binaries, setBinaries] = useState<{ name: string; exists: boolean }[]>([
    { name: "yt-dlp", exists: false },
    { name: "ffmpeg", exists: false },
  ]);

  useEffect(() => {
    checkBinaries();
    
    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen<string>("download-log", (event) => {
          setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${event.payload}`]);
        });
        return unlisten;
      } catch (e) {
        console.error("Failed to setup log listener:", e);
      }
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then(unlisten => unlisten && unlisten());
    };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const checkBinaries = async () => {
    const updated = await Promise.all(
      binaries.map(async (bin) => ({
        ...bin,
        exists: await invoke("check_binary", { name: bin.name }) as boolean,
      }))
    );
    setBinaries(updated);
  };

  const downloadBinary = async (name: string) => {
    setIsLoading(name);
    setStatus(`Processando ${name}...`);
    try {
      await invoke("download_binary", { name });
      setStatus(`${name} finalizado.`);
      checkBinaries();
    } catch (e) {
      setStatus(`Erro: ${e}`);
    } finally {
      setIsLoading(null);
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

  const openBinFolder = async () => {
    try {
      const { Command } = await import("@tauri-apps/plugin-shell");
      const path = await invoke("get_bin_path") as string;
      await Command.create("explorer", [path]).execute();
    } catch (e) {
      console.error("Erro ao abrir pasta:", e);
    }
  };

  const openRepoUrl = async (name: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      const url = name === "yt-dlp" 
        ? "https://github.com/yt-dlp/yt-dlp" 
        : "https://www.gyan.dev/ffmpeg/builds/";
      await open(url);
    } catch (e) {
      console.error("Erro ao abrir URL:", e);
    }
  };

  return (
    <div className="glass">
      <header style={{ marginBottom: "20px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer" }}>
          <h1 className="gradient-text" style={{ fontSize: "1.8rem", margin: "0" }}>MeTool</h1>
          <p style={{ opacity: 0.6, fontSize: "0.8rem" }}>{view === "home" ? "Desktop Client" : "Configurações"}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setView(view === "home" ? "config" : "home")} className="control-btn" title="Configurações">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
          <button onClick={minimizeWindow} className="control-btn" title="Minimizar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button onClick={hideWindow} className="control-btn close" title="Esconder">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </header>

      {view === "home" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", opacity: 0.5 }}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: "20px" }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>Selecione uma ação</p>
          <button onClick={() => setView("config")} style={{ marginTop: "10px", fontSize: "0.8rem" }}>
            Gerenciar Binários
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "left", flex: 1, display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.5, margin: 0 }}>Dependências</h2>
              <button onClick={openBinFolder} style={{ fontSize: "0.7rem", padding: "4px 8px", opacity: 0.7 }}>
                Abrir Pasta
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {binaries.map((bin) => (
                <div key={bin.name} className="binary-card" style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "10px 14px", 
                  background: "rgba(255,255,255,0.02)", 
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.05)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ 
                      width: "6px", 
                      height: "6px", 
                      borderRadius: "50%", 
                      background: bin.exists ? "#4ade80" : "#f87171",
                      boxShadow: bin.exists ? "0 0 10px #4ade80" : "none"
                    }} />
                    <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>{bin.name}</span>
                    <button onClick={() => openRepoUrl(bin.name)} style={{ border: "none", background: "none", padding: 0, opacity: 0.3, cursor: "pointer" }} title="Ver Repositório">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                  </div>
                  <button 
                    disabled={isLoading !== null}
                    onClick={() => downloadBinary(bin.name)} 
                    style={{ fontSize: "0.7rem", padding: "4px 10px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {isLoading === bin.name ? <div className="spinner" /> : (bin.exists ? "Atualizar" : "Instalar")}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <h2 style={{ fontSize: "0.8rem", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.5 }}>Console de Saída</h2>
            <div 
              ref={scrollRef}
              style={{ 
                flex: 1, 
                background: "#000", 
                borderRadius: "8px", 
                padding: "12px", 
                fontFamily: "monospace", 
                fontSize: "0.75rem", 
                color: "#aaa",
                overflowY: "auto",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}
              className="custom-scroll"
            >
              {logs.map((log, i) => (
                <div key={i} style={{ borderLeft: "2px solid #333", paddingLeft: "8px" }}>
                  {log}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <footer style={{ marginTop: "15px", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.03)" }}>
        <div style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "8px", opacity: 0.7 }}>
          <span style={{ color: status.includes("Erro") ? "#f87171" : "#6366f1" }}>●</span>
          <span>{status}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

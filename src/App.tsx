import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { i18n, Language } from "./i18n";

interface FormatOption {
  format_id: string;
  resolution: string;
  ext: string;
  filesize?: number;
}

function FormatSelect({
  formats,
  value,
  onChange,
}: {
  formats: FormatOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = formats.find((f) => f.format_id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fmt = (f: FormatOption) => {
    const size = f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) + " MB" : "?";
    return `${f.resolution} · ${f.ext.toUpperCase()} · ${size}`;
  };

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          padding: "8px 12px",
          color: "white",
          fontSize: "0.8rem",
          cursor: "pointer",
          gap: "8px",
          transition: "border-color 0.2s",
          borderColor: open ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? fmt(selected) : "Selecionar..."}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            opacity: 0.5,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "rgba(15,15,20,0.97)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 50,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          }}
          className="custom-scroll"
        >
          {formats.map((f, i) => {
            const isSelected = f.format_id === value;
            return (
              <button
                key={f.format_id}
                onClick={() => { onChange(f.format_id); setOpen(false); }}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 12px",
                  background: isSelected ? "rgba(99,102,241,0.15)" : "transparent",
                  border: "none",
                  borderBottom: i < formats.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  borderRadius: i === 0 ? "12px 12px 0 0" : i === formats.length - 1 ? "0 0 12px 12px" : "0",
                  color: isSelected ? "#818cf8" : "rgba(255,255,255,0.8)",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: "8px",
                }}
              >
                <span style={{ fontWeight: isSelected ? 600 : 400 }}>{f.resolution}</span>
                <span style={{ opacity: 0.45, fontSize: "0.72rem", display: "flex", gap: "6px" }}>
                  <span>{f.ext.toUpperCase()}</span>
                  <span>·</span>
                  <span>{f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) + " MB" : "?"}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function App() {
  const [lang, setLang] = useState<Language>("pt");
  const t = i18n[lang];

  const [status, setStatus] = useState<string>(i18n.pt.ready);
  const [logs, setLogs] = useState<string[]>(["MeTool Initialized..."]);
  const [view, setView] = useState<"home" | "config">("home");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
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
    setStatus(`${t.processing} ${name}...`);
    try {
      await invoke("download_binary", { name, lang });
      setStatus(`${name} ${t.finished}.`);
      checkBinaries();
    } catch (e) {
      setStatus(`${t.error}: ${e}`);
    } finally {
      setIsLoading(null);
    }
  };

  const fetchVideoInfo = async () => {
    if (!videoUrl) return;
    setIsLoading("fetching");
    setStatus(t.fetching_info);
    try {
      const info = await invoke("get_video_info", { url: videoUrl });
      setVideoInfo(info);
      const best = (info as any).formats[0]?.format_id || "";
      setSelectedFormat(best);
      setStatus(t.ready);
    } catch (e) {
      setStatus(`${t.error}: ${e}`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleVideoDownload = async () => {
    if (!videoUrl || !selectedFormat) return;

    const missingDeps = binaries.filter(b => !b.exists);
    if (missingDeps.length > 0) {
      setView("config");
      setStatus(t.error);
      return;
    }

    setIsLoading("video");
    setStatus(t.processing);
    try {
      await invoke("download_video", { 
        url: videoUrl, 
        formatId: selectedFormat,
        customPath: downloadPath 
      });
      setStatus(t.finished);
      setVideoUrl("");
      setVideoInfo(null);
    } catch (e) {
      console.error(e);
      setStatus(`${t.error}: ${e}`);
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
      await invoke("open_bin_dir");
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

  const selectDownloadPath = async () => {
    try {
      const result = await invoke<string | null>("pick_folder");
      if (result) {
        setDownloadPath(result);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="glass">
      <header style={{ marginBottom: "20px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer" }}>
          <h1 className="gradient-text" style={{ fontSize: "1.8rem", margin: "0" }}>{t.title}</h1>
          <p style={{ opacity: 0.6, fontSize: "0.8rem" }}>{view === "home" ? t.home_subtitle : t.config_subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setView(view === "home" ? "config" : "home")} className="control-btn" title={t.config_subtitle}>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", paddingTop: "10px", overflowY: "auto" }} className="custom-scroll">
          <div className="input-group">
            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                type="text" 
                className="input-field" 
                style={{ flex: 1 }}
                placeholder={t.video_url_placeholder}
                value={videoUrl}
                onChange={(e) => { setVideoUrl(e.target.value); setVideoInfo(null); }}
              />
              <button 
                onClick={fetchVideoInfo} 
                disabled={!videoUrl || isLoading !== null}
                style={{ borderRadius: "12px", padding: "0 15px", background: "rgba(255,255,255,0.05)" }}
              >
                {isLoading === "fetching" ? <div className="spinner" /> : "🔍"}
              </button>
            </div>

            {videoInfo && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "15px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: "0 0 12px 0", fontWeight: "600", fontSize: "0.9rem" }}>{videoInfo.title}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "0.75rem", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t.quality}</span>
                    <FormatSelect
                      formats={videoInfo.formats}
                      value={selectedFormat}
                      onChange={setSelectedFormat}
                    />
                  </div>
                  
                  <button 
                    className="download-btn" 
                    disabled={isLoading !== null}
                    onClick={handleVideoDownload}
                    style={{ marginTop: "10px" }}
                  >
                    {isLoading === "video" ? <div className="spinner" /> : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        {t.download_video}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {!binaries.every(b => b.exists) && (
            <div style={{ padding: "12px", background: "rgba(248, 113, 113, 0.1)", borderRadius: "10px", border: "1px solid rgba(248, 113, 113, 0.2)" }}>
              <p style={{ fontSize: "0.75rem", margin: 0, color: "#f87171" }}>
                Dependências faltando. 
                <span onClick={() => setView("config")} style={{ textDecoration: "underline", marginLeft: "5px", cursor: "pointer" }}>
                  Resolver
                </span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "left", flex: 1, display: "flex", flexDirection: "column", gap: "15px", overflowY: "auto", paddingRight: "2px" }} className="custom-scroll">
          <section>
            <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.5, marginBottom: "10px" }}>{t.download_path}</h2>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "10px" }}>
              <span style={{ fontSize: "0.75rem", opacity: 0.6, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {downloadPath || "Padrão (Downloads)"}
              </span>
              <button onClick={selectDownloadPath} style={{ fontSize: "0.7rem", padding: "4px 8px" }}>
                {t.select_folder}
              </button>
            </div>
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.5, margin: 0 }}>{t.language}</h2>
              <div style={{ display: "flex", gap: "5px" }}>
                {(['pt', 'en', 'es'] as Language[]).map(l => (
                  <button key={l} onClick={() => setLang(l)} style={{ 
                    padding: "2px 8px", 
                    fontSize: "0.7rem", 
                    background: lang === l ? "rgba(99, 102, 241, 0.2)" : "transparent",
                    borderColor: lang === l ? "#6366f1" : "rgba(255,255,255,0.1)"
                  }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.5, margin: 0 }}>{t.dependencies}</h2>
              <button onClick={openBinFolder} style={{ fontSize: "0.7rem", padding: "4px 8px", opacity: 0.7 }}>
                {t.open_folder}
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
                    <button onClick={() => openRepoUrl(bin.name)} style={{ border: "none", background: "none", padding: 0, opacity: 0.3, cursor: "pointer" }} title={t.repo_tooltip}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                  </div>
                  <button 
                    disabled={isLoading !== null}
                    onClick={() => downloadBinary(bin.name)} 
                    style={{ fontSize: "0.7rem", padding: "4px 10px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {isLoading === bin.name ? <div className="spinner" /> : (bin.exists ? t.update : t.install)}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: "0.8rem", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.5 }}>{t.output_console}</h2>
            <div 
              ref={scrollRef}
              style={{ 
                height: "140px",
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
          <span style={{ color: status.includes(t.error) ? "#f87171" : "#6366f1" }}>●</span>
          <span>{status}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import logo from "../assets/logo.svg";

interface Props {
  onOpenBundle: (path: string) => void;
  error: string | null;
  onClearError: () => void;
}

interface ModalState {
  title: string;
  body: string;
  kind: "success" | "error" | "info";
  list?: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export default function HomePage({ onOpenBundle, error, onClearError }: Props) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleOpen = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "PortableWeb Bundle", extensions: ["pweb"] }],
    });
    if (path) onOpenBundle(path as string);
  };

  const handlePack = async () => {
    const source = await open({ directory: true, multiple: false });
    if (!source) return;
    const output = await save({
      filters: [{ name: "PortableWeb Bundle", extensions: ["pweb"] }],
    });
    if (!output) return;
    try {
      await invoke("pack_folder", { source, output });
      setModal({ title: "Packed", body: `Bundle saved to:\n${output}`, kind: "success" });
    } catch (e) {
      setModal({ title: "Pack failed", body: String(e), kind: "error" });
    }
  };

  const handleValidate = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "PortableWeb Bundle", extensions: ["pweb"] }],
    });
    if (!path) return;
    try {
      const result = await invoke<ValidationResult>("validate_bundle", { path });
      if (result.valid) {
        setModal({ title: "Valid ✓", body: "Bundle passes all spec checks.", kind: "success" });
      } else {
        setModal({
          title: "Invalid bundle",
          body: "The following issues were found:",
          kind: "error",
          list: result.errors,
        });
      }
    } catch (e) {
      setModal({ title: "Validation failed", body: String(e), kind: "error" });
    }
  };

  const handleInit = async () => {
    const dest = await open({ directory: true, multiple: false });
    if (!dest) return;
    const title = prompt("Project title:", "My PortableWeb");
    if (!title) return;
    try {
      await invoke("init_project", { dest, title });
      setModal({
        title: "Project created",
        body: `Scaffolded in:\n${dest}\n\nRun "pweb pack" to build the bundle.`,
        kind: "success",
      });
    } catch (e) {
      setModal({ title: "Init failed", body: String(e), kind: "error" });
    }
  };

  const actions = [
    {
      id: "open",
      icon: "⊞",
      label: "Open .pweb",
      desc: "View an interactive bundle",
      accentColor: "var(--blue)",
      onClick: handleOpen,
    },
    {
      id: "pack",
      icon: "⊡",
      label: "Pack Folder",
      desc: "Create a .pweb from a directory",
      accentColor: "var(--purple)",
      onClick: handlePack,
    },
    {
      id: "validate",
      icon: "✓",
      label: "Validate",
      desc: "Check a .pweb against the spec",
      accentColor: "var(--green)",
      onClick: handleValidate,
    },
    {
      id: "init",
      icon: "+",
      label: "New Project",
      desc: "Scaffold a .pweb project",
      accentColor: "var(--amber)",
      onClick: handleInit,
    },
  ];

  return (
    <div className={`home${dragOver ? " drag-over" : ""}`}>
      <div className="home-header">
        <img src={logo} className="home-logo" alt="PortableWeb" />
        <div className="home-title">PortableWeb</div>
        <div className="home-subtitle">Interactive document viewer</div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="error-dismiss" onClick={onClearError}>✕</button>
        </div>
      )}

      <div className="action-grid">
        {actions.map((action) => (
          <button
            key={action.id}
            className="action-card"
            onClick={action.onClick}
            style={{ ["--accent" as string]: action.accentColor }}
          >
            <div className="action-icon" style={{ color: action.accentColor }}>
              {action.icon}
            </div>
            <div className="action-label">{action.label}</div>
            <div className="action-desc">{action.desc}</div>
          </button>
        ))}
      </div>

      <div className="drop-hint">Drop a .pweb file anywhere to open it</div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{modal.title}</div>
            <div className={`modal-body ${modal.kind === "success" ? "success" : modal.list ? "error-list" : ""}`}>
              {modal.list ? (
                <ul>
                  {modal.list.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{modal.body}</span>
              )}
            </div>
            <button className="modal-close" onClick={() => setModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

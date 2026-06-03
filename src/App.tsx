import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import HomePage from "./components/HomePage";
import ViewerPage from "./components/ViewerPage";

export interface BundleInfo {
  session_id: string;
  title: string;
  entry: string;
}

export default function App() {
  const [bundle, setBundle] = useState<BundleInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openBundle = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<BundleInfo>("open_bundle", { path });
      setBundle(info);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // OS file association open (double-click) and pweb open <file> CLI
    const unlistenOpen = listen<string>("open-bundle", (event) => {
      openBundle(event.payload);
    });

    // File drag-and-drop onto the window
    const unlistenDrop = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const pweb = event.payload.paths.find((p) => p.endsWith(".pweb"));
        if (pweb) openBundle(pweb);
      }
    });

    return () => {
      unlistenOpen.then((f) => f());
      unlistenDrop.then((f) => f());
    };
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Opening bundle</div>
      </div>
    );
  }

  if (bundle) {
    return (
      <div className="app">
        <ViewerPage
          bundle={bundle}
          onClose={() => setBundle(null)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <HomePage
        onOpenBundle={openBundle}
        error={error}
        onClearError={() => setError(null)}
      />
    </div>
  );
}

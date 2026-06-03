use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;

use mime_guess::from_path;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use zip::ZipArchive;

// ── State ────────────────────────────────────────────────────────────────────

/// Maps session_id → extracted temp directory for that bundle.
pub struct BundleRegistry(pub Mutex<HashMap<String, PathBuf>>);

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct BundleInfo {
    pub session_id: String,
    pub title: String,
    pub entry: String,
}

#[derive(Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Extract a .pweb bundle into a temp dir and register a session for it.
#[tauri::command]
pub fn open_bundle(
    state: State<'_, BundleRegistry>,
    path: String,
) -> Result<BundleInfo, String> {
    let session_id = Uuid::new_v4().to_string();
    let temp_dir = std::env::temp_dir().join(format!("pweb-{}", &session_id));
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let file = std::fs::File::open(&path).map_err(|e| format!("Cannot open file: {e}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|_| "Not a valid .pweb file (ZIP parse failed)".to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_path = temp_dir.join(entry.name());

        // Path traversal guard
        if !entry_path.starts_with(&temp_dir) {
            continue;
        }

        if entry.is_dir() {
            std::fs::create_dir_all(&entry_path).ok();
        } else {
            if let Some(parent) = entry_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let mut data = Vec::new();
            entry.read_to_end(&mut data).map_err(|e| e.to_string())?;
            std::fs::write(&entry_path, data).map_err(|e| e.to_string())?;
        }
    }

    let (title, entry) = read_manifest_meta(&temp_dir);
    state.0.lock().unwrap().insert(session_id.clone(), temp_dir);

    Ok(BundleInfo { session_id, title, entry })
}

/// Validate a .pweb bundle against the spec.
#[tauri::command]
pub fn validate_bundle(path: String) -> Result<ValidationResult, String> {
    let file = std::fs::File::open(&path).map_err(|e| format!("Cannot open file: {e}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|_| "Not a valid ZIP archive".to_string())?;

    let mut errors: Vec<String> = Vec::new();

    if archive.len() == 0 {
        errors.push("Archive is empty".into());
        return Ok(ValidationResult { valid: false, errors });
    }

    // First entry must be "mimetype"
    if let Ok(first) = archive.by_index(0) {
        if first.name() != "mimetype" {
            errors.push(format!(
                "First ZIP entry must be 'mimetype', found '{}'",
                first.name()
            ));
        }
    }

    // manifest.json must exist and have required fields
    match archive.by_name("manifest.json") {
        Err(_) => errors.push("Missing manifest.json".into()),
        Ok(mut entry) => {
            let mut content = String::new();
            entry.read_to_string(&mut content).ok();
            match serde_json::from_str::<serde_json::Value>(&content) {
                Err(_) => errors.push("manifest.json is not valid JSON".into()),
                Ok(manifest) => {
                    for field in &["spec_version", "id", "version", "title", "entry"] {
                        if manifest.get(field).is_none() {
                            errors.push(format!("manifest.json missing required field: '{field}'"));
                        }
                    }
                    // entry file must exist in archive
                    if let Some(entry_file) = manifest["entry"].as_str() {
                        if archive.by_name(entry_file).is_err() {
                            errors.push(format!("Entry file '{entry_file}' not found in bundle"));
                        }
                    }
                }
            }
        }
    }

    Ok(ValidationResult {
        valid: errors.is_empty(),
        errors,
    })
}

/// Pack a source directory into a .pweb bundle.
#[tauri::command]
pub fn pack_folder(source: String, output: String) -> Result<(), String> {
    use zip::write::SimpleFileOptions;
    use zip::CompressionMethod;

    let source = PathBuf::from(&source);
    let out_file = std::fs::File::create(&output).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(out_file);

    // mimetype must be first entry, stored (uncompressed), no extra fields
    let mimetype_path = source.join("mimetype");
    if mimetype_path.exists() {
        let content = std::fs::read(&mimetype_path).map_err(|e| e.to_string())?;
        let opts = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Stored);
        zip.start_file("mimetype", opts).map_err(|e| e.to_string())?;
        zip.write_all(&content).map_err(|e| e.to_string())?;
    } else {
        // Write default mimetype
        let opts = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Stored);
        zip.start_file("mimetype", opts).map_err(|e| e.to_string())?;
        zip.write_all(b"application/vnd.portableweb+zip").map_err(|e| e.to_string())?;
    }

    add_dir_to_zip(&mut zip, &source, &source, &["mimetype"])?;
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

/// Scaffold a new .pweb project in the given directory.
#[tauri::command]
pub fn init_project(dest: String, title: String) -> Result<(), String> {
    let dir = PathBuf::from(&dest);

    // mimetype
    std::fs::write(dir.join("mimetype"), "application/vnd.portableweb+zip")
        .map_err(|e| e.to_string())?;

    // manifest.json
    let id = title.to_lowercase().replace(' ', "-");
    let manifest = serde_json::json!({
        "spec_version": "0.1",
        "id": format!("org.portableweb.{id}"),
        "version": "0.1.0",
        "title": title,
        "entry": "index.html"
    });
    std::fs::write(
        dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .map_err(|e| e.to_string())?;

    // index.html
    std::fs::write(
        dir.join("index.html"),
        format!(
            r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>{title}</h1>
  <script src="script.js"></script>
</body>
</html>
"#
        ),
    )
    .map_err(|e| e.to_string())?;

    // style.css
    std::fs::write(
        dir.join("style.css"),
        "body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }\n",
    )
    .map_err(|e| e.to_string())?;

    // script.js
    std::fs::write(dir.join("script.js"), "// Your bundle logic here\n")
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn read_manifest_meta(dir: &PathBuf) -> (String, String) {
    let defaults = ("PortableWeb".to_string(), "index.html".to_string());
    let Ok(content) = std::fs::read_to_string(dir.join("manifest.json")) else {
        return defaults;
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) else {
        return defaults;
    };
    let title = v["title"].as_str().unwrap_or("PortableWeb").to_string();
    let entry = v["entry"].as_str().unwrap_or("index.html").to_string();
    (title, entry)
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &PathBuf,
    dir: &PathBuf,
    skip: &[&str],
) -> Result<(), String> {
    use zip::write::SimpleFileOptions;

    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let relative = path.strip_prefix(base).map_err(|e| e.to_string())?;
        let name = relative.to_string_lossy().replace('\\', "/");

        if skip.contains(&name.as_str()) {
            continue;
        }

        if path.is_dir() {
            add_dir_to_zip(zip, base, &path, skip)?;
        } else {
            let opts = SimpleFileOptions::default();
            zip.start_file(&name, opts).map_err(|e| e.to_string())?;
            let data = std::fs::read(&path).map_err(|e| e.to_string())?;
            zip.write_all(&data).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ── Protocol handler ──────────────────────────────────────────────────────────

fn handle_pweb_request(
    app: &AppHandle,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    let uri = request.uri().to_string();
    // URI shape: pweb://<session_id>/<file_path>
    let without_scheme = uri.strip_prefix("pweb://").unwrap_or(&uri);
    let (session_id, file_path) = without_scheme
        .split_once('/')
        .unwrap_or((without_scheme, "index.html"));
    let file_path = if file_path.is_empty() { "index.html" } else { file_path };

    let registry = app.state::<BundleRegistry>();
    let registry = registry.0.lock().unwrap();

    let Some(bundle_dir) = registry.get(session_id) else {
        return tauri::http::Response::builder()
            .status(404)
            .body(b"Bundle session not found".to_vec())
            .unwrap();
    };

    let full_path = bundle_dir.join(file_path);

    // Path traversal guard
    if !full_path.starts_with(bundle_dir) {
        return tauri::http::Response::builder()
            .status(403)
            .body(b"Forbidden".to_vec())
            .unwrap();
    }

    match std::fs::read(&full_path) {
        Ok(data) => {
            let mime = from_path(&full_path).first_or_octet_stream().to_string();
            tauri::http::Response::builder()
                .header("Content-Type", mime)
                .header("Access-Control-Allow-Origin", "*")
                .body(data)
                .unwrap()
        }
        Err(_) => tauri::http::Response::builder()
            .status(404)
            .body(b"File not found".to_vec())
            .unwrap(),
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Raised when a second instance is launched (e.g. double-clicking
            // another .pweb while the viewer is already open).
            if let Some(path) = args.get(1).filter(|p| p.ends_with(".pweb")) {
                let _ = app.emit("open-bundle", path);
            }
            // Bring the existing window to front
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .manage(BundleRegistry(Default::default()))
        .register_uri_scheme_protocol("pweb", handle_pweb_request)
        .setup(|app| {
            // Handle file path passed as a CLI argument (Windows / Linux /
            // pweb open <file>). On macOS, double-click fires an Apple Event
            // handled by tauri-plugin-single-instance instead.
            let args: Vec<String> = std::env::args().collect();
            if let Some(path) = args.get(1).filter(|p| p.ends_with(".pweb")) {
                app.emit("open-bundle", path)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_bundle,
            validate_bundle,
            pack_folder,
            init_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PortableWeb viewer");
}

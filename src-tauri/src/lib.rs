//! Reqit の Tauri アプリ本体。OS 連携と IPC コマンドだけを置き、処理は reqit-core に任せる。

mod commands;
mod secret;

use std::collections::HashMap;
use std::sync::Mutex;

use reqit_core::draft::DraftStore;
use reqit_core::{Engine, EngineConfig};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let engine = Engine::new(EngineConfig::default())?;
            app.manage(commands::AppState {
                engine,
                inflight: Mutex::new(HashMap::new()),
                drafts: DraftStore::new(data_dir.join("last-request.json")),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_request,
            commands::cancel_request,
            commands::load_last_request,
            commands::save_last_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Reqit");
}

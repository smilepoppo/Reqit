//! フロントエンドから呼び出す IPC コマンド。
//!
//! HTTP 通信は必ずここを経由して `reqit_core::Engine` で実行する。

use std::collections::HashMap;
use std::sync::Mutex;

use reqit_core::curl::{self, CurlError, CurlStyle, ParsedCurl};
use reqit_core::draft::{DraftStore, SaveOutcome};
use reqit_core::{CancellationToken, Engine, EngineError, RequestSpec, ResponseData};
use tauri::State;

use crate::secret::KeyringSecretStore;

/// 送信中リクエストの ID の最大長。フロントエンドが生成する UUID を想定する。
const MAX_REQUEST_ID_LEN: usize = 64;

pub struct AppState {
    pub engine: Engine,
    pub inflight: Mutex<HashMap<String, CancellationToken>>,
    pub drafts: DraftStore,
}

fn validate_id(id: &str) -> Result<(), EngineError> {
    if id.is_empty()
        || id.len() > MAX_REQUEST_ID_LEN
        || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err(EngineError::Other {
            detail: "invalid request id".into(),
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn send_request(
    state: State<'_, AppState>,
    request_id: String,
    spec: RequestSpec,
) -> Result<ResponseData, EngineError> {
    validate_id(&request_id)?;
    let token = CancellationToken::new();
    state
        .inflight
        .lock()
        .map_err(|_| EngineError::Other {
            detail: "state lock poisoned".into(),
        })?
        .insert(request_id.clone(), token.clone());

    let result = state.engine.send(&spec, &token).await;

    if let Ok(mut map) = state.inflight.lock() {
        map.remove(&request_id);
    }
    result
}

/// 送信中のリクエストをキャンセルする。該当が無い場合は false を返す。
#[tauri::command]
pub fn cancel_request(state: State<'_, AppState>, request_id: String) -> bool {
    let Ok(map) = state.inflight.lock() else {
        return false;
    };
    match map.get(&request_id) {
        Some(token) => {
            token.cancel();
            true
        }
        None => false,
    }
}

#[tauri::command]
pub async fn load_last_request(state: State<'_, AppState>) -> Result<Option<RequestSpec>, ()> {
    let drafts = state.drafts.clone();
    // keyring とファイル I/O はブロッキング処理のため、専用スレッドで実行する。
    Ok(
        tauri::async_runtime::spawn_blocking(move || drafts.load(&KeyringSecretStore))
            .await
            .ok()
            .flatten(),
    )
}

#[tauri::command]
pub async fn save_last_request(
    state: State<'_, AppState>,
    spec: RequestSpec,
) -> Result<SaveOutcome, String> {
    let drafts = state.drafts.clone();
    tauri::async_runtime::spawn_blocking(move || drafts.save(&spec, &KeyringSecretStore))
        .await
        .map_err(|e| e.to_string())?
}

/// curl コマンドを読み込む。通信は行わない。
#[tauri::command]
pub fn parse_curl(input: String) -> Result<ParsedCurl, CurlError> {
    curl::parse_curl(&input)
}

/// リクエストを curl コマンドに変換する。通信は行わない。
#[tauri::command]
pub fn export_curl(spec: RequestSpec, style: CurlStyle) -> String {
    curl::to_curl(&spec, style)
}

#[cfg(test)]
mod tests {
    use super::validate_id;

    #[test]
    fn request_id_validation() {
        assert!(validate_id("3f2b9c1e-0000-4000-8000-000000000000").is_ok());
        assert!(validate_id("").is_err());
        assert!(validate_id("../etc").is_err());
        assert!(validate_id(&"a".repeat(65)).is_err());
    }
}

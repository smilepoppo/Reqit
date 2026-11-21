//! 前回入力したリクエストの保存と復元（History Store の最小構成）。
//!
//! 秘密情報は `secrets::split_secrets` で分離し、JSON ファイルには書かない。
//! 分離した値は `SecretStore`（Windows では Credential Manager）に保存する。

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::model::RequestSpec;
use crate::secrets::{SecretBundle, merge_secrets, split_secrets};

/// Windows Credential Manager の 1 件あたりの上限（2,560 バイト）。
/// 保存形式が UTF-16 でも収まるよう、文字数でも制限する。
pub const SECRET_BLOB_LIMIT_BYTES: usize = 2560;

/// 秘密情報の保存先。OS の資格情報ストアなどで実装する。
pub trait SecretStore {
    fn get(&self) -> Result<Option<String>, String>;
    fn set(&self, value: &str) -> Result<(), String>;
    fn delete(&self) -> Result<(), String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SecretPersistence {
    /// 保存すべき秘密情報が無かった。
    None,
    /// Secret Store に保存した。
    Stored,
    /// 容量超過のため保存しなかった。
    TooLarge,
    /// Secret Store が使えなかったため保存しなかった。
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOutcome {
    pub secrets: SecretPersistence,
}

#[derive(Debug, Serialize, Deserialize)]
struct DraftFile {
    version: u32,
    request: RequestSpec,
}

const DRAFT_VERSION: u32 = 1;

#[derive(Debug, Clone)]
pub struct DraftStore {
    path: PathBuf,
}

impl DraftStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// リクエストを保存する。秘密情報はファイルに書かない。
    pub fn save(
        &self,
        spec: &RequestSpec,
        secrets: &dyn SecretStore,
    ) -> Result<SaveOutcome, String> {
        let (clean, bundle) = split_secrets(spec);
        let file = DraftFile {
            version: DRAFT_VERSION,
            request: clean,
        };
        let json = serde_json::to_vec_pretty(&file).map_err(|e| e.to_string())?;
        write_atomic(&self.path, &json)?;

        let persistence = if bundle.is_empty() {
            let _ = secrets.delete();
            SecretPersistence::None
        } else {
            let blob = serde_json::to_string(&bundle).map_err(|e| e.to_string())?;
            if !fits_secret_limit(&blob) {
                let _ = secrets.delete();
                SecretPersistence::TooLarge
            } else if secrets.set(&blob).is_ok() {
                SecretPersistence::Stored
            } else {
                SecretPersistence::Unavailable
            }
        };
        Ok(SaveOutcome {
            secrets: persistence,
        })
    }

    /// 保存済みのリクエストを読み込む。ファイルが無い・壊れている場合は `None`。
    pub fn load(&self, secrets: &dyn SecretStore) -> Option<RequestSpec> {
        let bytes = fs::read(&self.path).ok()?;
        let file: DraftFile = serde_json::from_slice(&bytes).ok()?;
        if file.version != DRAFT_VERSION {
            return None;
        }
        let bundle = secrets
            .get()
            .ok()
            .flatten()
            .and_then(|s| serde_json::from_str::<SecretBundle>(&s).ok())
            .unwrap_or_default();
        Some(merge_secrets(file.request, bundle))
    }
}

fn fits_secret_limit(s: &str) -> bool {
    s.len() <= SECRET_BLOB_LIMIT_BYTES && s.encode_utf16().count() * 2 <= SECRET_BLOB_LIMIT_BYTES
}

/// 一時ファイルに書いてから置き換え、書き込み途中でファイルが壊れないようにする。
fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(data).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// テストや Secret Store が無い環境向けの、メモリ上の実装。
#[derive(Debug, Default)]
pub struct MemorySecretStore {
    value: std::sync::Mutex<Option<String>>,
    pub fail: bool,
}

impl SecretStore for MemorySecretStore {
    fn get(&self) -> Result<Option<String>, String> {
        if self.fail {
            return Err("unavailable".into());
        }
        Ok(self.value.lock().map_err(|e| e.to_string())?.clone())
    }
    fn set(&self, value: &str) -> Result<(), String> {
        if self.fail {
            return Err("unavailable".into());
        }
        *self.value.lock().map_err(|e| e.to_string())? = Some(value.to_owned());
        Ok(())
    }
    fn delete(&self) -> Result<(), String> {
        if self.fail {
            return Err("unavailable".into());
        }
        *self.value.lock().map_err(|e| e.to_string())? = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Auth, HttpMethod, KeyValue};

    fn sample() -> RequestSpec {
        RequestSpec {
            method: HttpMethod::Post,
            url: "https://example.com/api".into(),
            headers: vec![KeyValue::new("Authorization", "Bearer dummy-header-token")],
            auth: Auth::Basic {
                username: "alice".into(),
                password: "dummy-password".into(),
            },
            ..Default::default()
        }
    }

    #[test]
    fn roundtrip_with_secret_store() {
        let dir = tempfile::tempdir().unwrap();
        let store = DraftStore::new(dir.path().join("last-request.json"));
        let secrets = MemorySecretStore::default();
        let out = store.save(&sample(), &secrets).unwrap();
        assert_eq!(out.secrets, SecretPersistence::Stored);

        let on_disk = fs::read_to_string(store.path()).unwrap();
        assert!(!on_disk.contains("dummy-password"));
        assert!(!on_disk.contains("dummy-header-token"));
        assert!(on_disk.contains("alice"));

        assert_eq!(store.load(&secrets), Some(sample()));
    }

    #[test]
    fn unavailable_secret_store_drops_secrets() {
        let dir = tempfile::tempdir().unwrap();
        let store = DraftStore::new(dir.path().join("d.json"));
        let secrets = MemorySecretStore {
            fail: true,
            ..Default::default()
        };
        let out = store.save(&sample(), &secrets).unwrap();
        assert_eq!(out.secrets, SecretPersistence::Unavailable);
        let loaded = store.load(&secrets).unwrap();
        assert_eq!(
            loaded.auth,
            Auth::Basic {
                username: "alice".into(),
                password: String::new()
            }
        );
        assert_eq!(loaded.headers[0].value, "");
    }

    #[test]
    fn oversized_secrets_are_not_stored() {
        let dir = tempfile::tempdir().unwrap();
        let store = DraftStore::new(dir.path().join("d.json"));
        let secrets = MemorySecretStore::default();
        let mut spec = sample();
        spec.auth = Auth::Bearer {
            token: "x".repeat(3000),
        };
        let out = store.save(&spec, &secrets).unwrap();
        assert_eq!(out.secrets, SecretPersistence::TooLarge);
        assert_eq!(secrets.get().unwrap(), None);
        let on_disk = fs::read_to_string(store.path()).unwrap();
        assert!(!on_disk.contains("xxxxxxxx"));
    }

    #[test]
    fn missing_or_corrupt_file_returns_none() {
        let dir = tempfile::tempdir().unwrap();
        let store = DraftStore::new(dir.path().join("d.json"));
        let secrets = MemorySecretStore::default();
        assert_eq!(store.load(&secrets), None);
        fs::write(store.path(), b"{broken").unwrap();
        assert_eq!(store.load(&secrets), None);
    }

    #[test]
    fn no_secrets_clears_previous_entry() {
        let dir = tempfile::tempdir().unwrap();
        let store = DraftStore::new(dir.path().join("d.json"));
        let secrets = MemorySecretStore::default();
        store.save(&sample(), &secrets).unwrap();
        let plain = RequestSpec {
            url: "https://example.com".into(),
            ..Default::default()
        };
        let out = store.save(&plain, &secrets).unwrap();
        assert_eq!(out.secrets, SecretPersistence::None);
        assert_eq!(secrets.get().unwrap(), None);
    }
}

//! Secret Store：OS の資格情報ストアに秘密情報を保存する。
//!
//! Windows では Credential Manager を使う。それ以外の OS では keyring の既定実装
//! （プラットフォーム機能を無効にしているため、メモリ上のモック）になり、永続化されない。

use reqit_core::draft::SecretStore;

const SERVICE: &str = "dev.reqit.app";
const ACCOUNT: &str = "last-request";

pub struct KeyringSecretStore;

impl KeyringSecretStore {
    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
    }
}

impl SecretStore for KeyringSecretStore {
    fn get(&self) -> Result<Option<String>, String> {
        match Self::entry()?.get_password() {
            Ok(v) => Ok(Some(v)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    fn set(&self, value: &str) -> Result<(), String> {
        Self::entry()?
            .set_password(value)
            .map_err(|e| e.to_string())
    }

    fn delete(&self) -> Result<(), String> {
        match Self::entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

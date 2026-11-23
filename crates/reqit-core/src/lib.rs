//! Reqit のコアライブラリ。
//!
//! Tauri や WebView に依存しない処理（HTTP 通信、データモデル、秘密情報の扱い、保存）を置く。

pub mod curl;
pub mod draft;
pub mod engine;
pub mod error;
pub mod model;
pub mod secrets;

pub use engine::{Engine, EngineConfig};
pub use error::EngineError;
pub use model::*;
pub use tokio_util::sync::CancellationToken;

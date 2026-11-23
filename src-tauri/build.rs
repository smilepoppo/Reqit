fn main() {
    // アプリのコマンドを明示的に宣言し、capabilities で許可したものだけを呼び出せるようにする。
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "send_request",
            "cancel_request",
            "load_last_request",
            "save_last_request",
            "parse_curl",
            "export_curl",
        ]),
    ))
    .expect("failed to run tauri-build");
}

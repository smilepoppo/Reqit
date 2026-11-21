// リリースビルドでは Windows のコンソールウィンドウを表示しない。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    reqit_lib::run();
}

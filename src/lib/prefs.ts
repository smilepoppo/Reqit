// テーマや言語など、秘密情報を含まない UI 設定の保存。
// localStorage が使えない環境（プライベートモードなど）でも動作するよう、例外は握りつぶす。

const PREFIX = "reqit.";

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // 保存できなくても動作に支障はない。
  }
}

import { useEffect, useRef, useState } from "react";
import { emptyDraft, draftToSpec, specToDraft, type Draft } from "../lib/draft";
import { isTauri, loadLastRequest, saveLastRequest } from "../lib/ipc";
import type { SecretPersistence } from "../lib/types";

const SAVE_DELAY_MS = 600;

/**
 * 編集中のリクエストを保持し、前回の入力を復元・自動保存する。
 * 保存は Rust 側で行い、秘密情報は設定ファイルに書かれない。
 */
export function usePersistentDraft() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  // Tauri 外（ブラウザでの UI 確認時）は読み込むものが無いため、最初から読み込み済みとする。
  const [loaded, setLoaded] = useState(() => !isTauri());
  const [secretStatus, setSecretStatus] = useState<SecretPersistence>("none");
  const userEdited = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    loadLastRequest()
      .then((spec) => {
        // 読み込み前にユーザーが入力を始めていた場合は上書きしない。
        if (active && spec && !userEdited.current) setDraft(specToDraft(spec));
      })
      .catch((e: unknown) => console.warn("failed to load last request", e))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !isTauri()) return;
    const timer = window.setTimeout(() => {
      saveLastRequest(draftToSpec(draft))
        .then((o) => setSecretStatus(o.secrets))
        .catch((e: unknown) => console.warn("failed to save last request", e));
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, loaded]);

  const update = (updater: (d: Draft) => Draft) => {
    userEdited.current = true;
    setDraft(updater);
  };

  return { draft, update, loaded, secretStatus };
}

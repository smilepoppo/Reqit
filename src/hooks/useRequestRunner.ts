import { useCallback, useEffect, useRef, useState } from "react";
import { cancelRequest, sendRequest } from "../lib/ipc";
import type { EngineError, RequestSpec, ResponseData } from "../lib/types";

export type RunState =
  | { phase: "idle" }
  | { phase: "sending"; startedAt: number }
  | { phase: "done"; response: ResponseData }
  | { phase: "error"; error: EngineError };

function newId(): string {
  return crypto.randomUUID();
}

/** リクエストの送信・キャンセルと、その状態を管理する。 */
export function useRequestRunner() {
  const [state, setState] = useState<RunState>({ phase: "idle" });
  const currentId = useRef<string | null>(null);

  const send = useCallback(async (spec: RequestSpec) => {
    // 前の送信が残っていればキャンセルし、結果は無視する。
    if (currentId.current) void cancelRequest(currentId.current).catch(() => false);
    const id = newId();
    currentId.current = id;
    setState({ phase: "sending", startedAt: performance.now() });
    try {
      const response = await sendRequest(id, spec);
      if (currentId.current === id) setState({ phase: "done", response });
    } catch (e) {
      if (currentId.current === id) setState({ phase: "error", error: e as EngineError });
    } finally {
      if (currentId.current === id) currentId.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    const id = currentId.current;
    if (!id) return;
    // Rust 側から Cancelled エラーが返り、send() 内で状態が更新される。
    void cancelRequest(id).catch(() => false);
  }, []);

  useEffect(
    () => () => {
      if (currentId.current) void cancelRequest(currentId.current).catch(() => false);
    },
    [],
  );

  return { state, send, cancel, sending: state.phase === "sending" };
}

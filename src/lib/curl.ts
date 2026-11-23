import type { MessageKey, Params } from "../i18n";
import type { CurlError, CurlWarning } from "./types";

type Msg = { key: MessageKey; params?: Params };

export function curlWarningMessage(w: CurlWarning): Msg {
  switch (w.kind) {
    case "unknownOption":
      return { key: "curl.warn.unknownOption", params: { option: w.option } };
    case "fileReferenceIgnored":
      return { key: "curl.warn.fileReferenceIgnored", params: { option: w.option } };
    case "insecureIgnored":
      return { key: "curl.warn.insecureIgnored" };
    case "multipartIgnored":
      return { key: "curl.warn.multipartIgnored" };
  }
}

export function curlErrorMessage(e: CurlError): Msg {
  switch (e.kind) {
    case "missingValue":
      return { key: "curl.err.missingValue", params: { option: e.option } };
    case "unsupportedMethod":
      return { key: "curl.err.unsupportedMethod", params: { method: e.method } };
    default:
      return { key: `curl.err.${e.kind}` };
  }
}

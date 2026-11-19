// HTTP ステータスの分類と、ユーザー向けヒントの辞書キー。

import type { MessageKey } from "../i18n";

export type StatusTone = "info" | "success" | "redirect" | "clientError" | "serverError";

export function statusTone(status: number): StatusTone {
  if (status >= 500) return "serverError";
  if (status >= 400) return "clientError";
  if (status >= 300) return "redirect";
  if (status >= 200) return "success";
  return "info";
}

const SPECIFIC: Record<number, MessageKey> = {
  400: "status.400",
  401: "status.401",
  403: "status.403",
  404: "status.404",
  405: "status.405",
  408: "status.408",
  409: "status.409",
  413: "status.413",
  415: "status.415",
  422: "status.422",
  429: "status.429",
  500: "status.500",
  502: "status.502",
  503: "status.503",
  504: "status.504",
};

/** エラー系ステータスのときだけ、原因の目安となるヒントを返す。 */
export function statusHint(status: number): MessageKey | undefined {
  const specific = SPECIFIC[status];
  if (specific) return specific;
  if (status >= 500) return "status.5xx";
  if (status >= 400) return "status.4xx";
  return undefined;
}

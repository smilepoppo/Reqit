import { useEffect, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { tags } from "@lezer/highlight";

interface Props {
  value: string;
  onChange?: (value: string) => void;
  language: "json" | "text";
  readOnly?: boolean;
  dark: boolean;
  placeholder?: string;
  ariaLabel: string;
  /** 折り返し表示。巨大な 1 行を折り返すと描画が極端に遅くなるため、大きな本文では無効にする。 */
  wrap?: boolean;
}

const lightHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "#7c3aed" },
  { tag: tags.string, color: "#047857" },
  { tag: tags.number, color: "#b45309" },
  { tag: [tags.bool, tags.null], color: "#2563eb" },
  { tag: tags.punctuation, color: "#64748b" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "#c4b5fd" },
  { tag: tags.string, color: "#6ee7b7" },
  { tag: tags.number, color: "#fcd34d" },
  { tag: [tags.bool, tags.null], color: "#93c5fd" },
  { tag: tags.punctuation, color: "#94a3b8" },
]);

function themeExtensions(dark: boolean) {
  return [
    EditorView.theme(
      {
        "&": { height: "100%", fontSize: "13px", backgroundColor: "transparent" },
        ".cm-scroller": {
          fontFamily: "ui-monospace, 'Cascadia Code', Consolas, 'BIZ UDGothic', monospace",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: dark ? "1px solid #334155" : "1px solid #e2e8f0",
          color: dark ? "#64748b" : "#94a3b8",
        },
        ".cm-activeLine": { backgroundColor: dark ? "#1e293b80" : "#f1f5f980" },
        "&.cm-focused": { outline: "none" },
        ".cm-content": { caretColor: dark ? "#e2e8f0" : "#0f172a" },
      },
      { dark },
    ),
    syntaxHighlighting(dark ? darkHighlight : lightHighlight),
  ];
}

/** CodeMirror 6 の薄いラッパー。ラッパーライブラリに依存しないよう自前で実装している。 */
export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  dark,
  placeholder,
  ariaLabel,
  wrap = true,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const compartments = useRef({
    theme: new Compartment(),
    lang: new Compartment(),
    readOnly: new Compartment(),
    wrap: new Compartment(),
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // エディタは 1 回だけ生成し、以降の変更は Compartment で反映する。
  useEffect(() => {
    if (!host.current) return;
    const c = compartments.current;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        c.wrap.of(wrap ? EditorView.lineWrapping : []),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
        placeholder ? placeholderExt(placeholder) : [],
        EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
        c.theme.of(themeExtensions(dark)),
        c.lang.of(language === "json" ? json() : []),
        c.readOnly.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // 初期化は 1 回だけ行う。以降の props 変更は下の effect で反映する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.theme.reconfigure(themeExtensions(dark)),
    });
  }, [dark]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.wrap.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  }, [wrap]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.lang.reconfigure(language === "json" ? json() : []),
    });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.readOnly.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" data-testid="code-editor" />;
}

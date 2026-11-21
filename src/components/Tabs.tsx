import { useRef, type ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
  trailing?: ReactNode;
}

/** WAI-ARIA の Tabs パターンに沿ったタブ。左右キーで移動できる。 */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  label,
  idPrefix,
  trailing,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const item = items[next];
    if (item) {
      onChange(item.id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
      <div role="tablist" aria-label={label} className="flex min-w-0 flex-1 overflow-x-auto">
        {items.map((item, i) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${idPrefix}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                selected
                  ? "border-indigo-500 text-slate-900 dark:text-slate-100"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

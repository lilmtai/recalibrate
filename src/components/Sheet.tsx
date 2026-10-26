import { useEffect, type CSSProperties, type ReactNode } from "react";

export function Sheet({ title, sub, onClose, children }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {sub && <div className="small muted">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

export function Chips<T extends string | number>({
  options, value, onChange, multi,
}: { options: { key: T; label: string; color?: string }[]; value: T | T[] | undefined; onChange: (v: T) => void; multi?: boolean }) {
  const on = (k: T) => (multi ? (value as T[]).includes(k) : value === k);
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o.key)} type="button" className="pick" aria-pressed={on(o.key)} onClick={() => onChange(o.key)}
          style={o.color ? ({ "--c": o.color } as CSSProperties) : undefined}>
          {o.color && <span className="swatch" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

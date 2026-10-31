import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useApp } from "../ctx";
import { Icon } from "./Icon";

/**
 * A pop-up panel. Always has a close button, a back button when another panel opened it,
 * and can be swiped down to close. The phone's back gesture also closes it (handled in App).
 */
export function Sheet({ title, sub, onClose, children }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode }) {
  const { back, canBack } = useApp();
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    start.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => { if (start.current !== null) setDy(Math.max(0, e.clientY - start.current)); };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (dy > 90) onClose();
    setDy(0);
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}
        style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}>
        <div className="sheethead" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="grabber" aria-hidden="true" />
          <div className="sheetbar">
            {canBack ? <button className="roundbtn" aria-label="Back" onClick={back}><Icon name="back" size={20} /></button> : <span />}
            <button className="roundbtn" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>
        </div>
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

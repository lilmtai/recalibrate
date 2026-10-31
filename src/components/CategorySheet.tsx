import { useState, type CSSProperties } from "react";
import { useApp } from "../ctx";
import { categoriesOf } from "../constants";
import { EMOJI_PICKS } from "../lib/emoji";
import type { Category } from "../types";
import { uid } from "../lib/time";
import { Sheet } from "./Sheet";

const COLORS = ["#2c49a6", "#6e52a3", "#2f8466", "#b84d72", "#2c8799", "#c0612b", "#4f7f9e", "#8a6a1f", "#5b5fc7", "#5e6176", "#a3477e", "#3d5a80", "#9a3f3f", "#4a7a2c"];

/** Your categories: rename, recolour, change the emoji, add your own, remove. */
export function CategorySheet() {
  const { state, update, close, toast } = useApp();
  const [list, setList] = useState<Category[]>(() => categoriesOf(state).map((c) => ({ ...c })));
  const [editing, setEditing] = useState<string | null>(null);
  const set = (key: string, patch: Partial<Category>) => setList((l) => l.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const add = () => {
    const c: Category = { key: `c_${uid()}`, label: "New category", color: COLORS[list.length % COLORS.length], emoji: "⭐" };
    setList((l) => [...l, c]);
    setEditing(c.key);
  };
  const save = () => {
    const clean = list.filter((c) => c.label.trim()).map((c) => ({ ...c, label: c.label.trim() }));
    update((s) => { s.categories = clean; });
    toast("Categories saved.");
    close();
  };
  const usedBy = (key: string) => state.tasks.filter((t) => t.category === key).length + state.routines.filter((r) => r.category === key).length;

  return (
    <Sheet title="Categories" sub="Colour-code your day your way. Blocks in a removed category show as “Other”." onClose={close}>
      <ul className="catlist">
        {list.map((c) => (
          <li key={c.key} style={{ "--c": c.color } as CSSProperties}>
            <button className="catrow2" onClick={() => setEditing(editing === c.key ? null : c.key)} aria-expanded={editing === c.key}>
              <span className="emojipill">{c.emoji}</span>
              <span className="grow"><b>{c.label}</b>{usedBy(c.key) > 0 && <span className="small muted"> · {usedBy(c.key)} blocks</span>}</span>
              <span className="swatch big" />
            </button>
            {editing === c.key && (
              <div className="catedit">
                <div className="field"><label htmlFor={`cl-${c.key}`}>Name</label>
                  <input id={`cl-${c.key}`} value={c.label} onChange={(e) => set(c.key, { label: e.target.value })} /></div>
                <div className="field"><span>Emoji</span>
                  <div className="emojigrid">
                    {EMOJI_PICKS.map((e) => <button key={e} type="button" className="emojibtn" aria-pressed={c.emoji === e} onClick={() => set(c.key, { emoji: e })}>{e}</button>)}
                  </div>
                  <input aria-label="Or type any emoji" placeholder="Or type any emoji" maxLength={4} onChange={(e) => e.target.value.trim() && set(c.key, { emoji: e.target.value.trim() })} />
                </div>
                <div className="field"><span>Colour</span>
                  <div className="chips">
                    {COLORS.map((col) => <button key={col} type="button" className="colorbtn" aria-label={`Colour ${col}`} aria-pressed={c.color === col} style={{ background: col }} onClick={() => set(c.key, { color: col })} />)}
                  </div>
                </div>
                <div className="actions" style={{ marginTop: 10 }}>
                  <button className="btn ghost small" onClick={() => { setList((l) => l.filter((x) => x.key !== c.key)); setEditing(null); }}>Remove</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="actions">
        <button className="btn" onClick={add}>Add a category</button>
        <span className="spacer" />
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

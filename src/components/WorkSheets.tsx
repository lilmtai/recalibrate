import { useState } from "react";
import { useApp } from "../ctx";
import { categoriesOf } from "../constants";
import type { CategoryKey, Page, Project } from "../types";
import { today, uid } from "../lib/time";
import { nowIso } from "../lib/work";
import { Chips, Sheet } from "./Sheet";

/** New or edit project: name, area, why it matters, and (new only) the first step. */
export function ProjectSheet({ project }: { project?: Project }) {
  const { state, update, close, toast } = useApp();
  const [name, setName] = useState(project?.name || "");
  const [area, setArea] = useState<CategoryKey>(project?.area || "side");
  const [why, setWhy] = useState(project?.why || "");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    if (!name.trim()) return setError("Give the project a name.");
    update((s) => {
      if (project) Object.assign(s.projects.find((p) => p.id === project.id)!, { name: name.trim(), area, why: why.trim() || undefined });
      else {
        const id = uid();
        s.projects.push({ id, name: name.trim(), area, why: why.trim() || undefined, status: "active", created: today() });
        if (first.trim()) s.steps.push({ id: uid(), projectId: id, text: first.trim(), done: false, order: 1, next: true });
      }
    });
    toast(project ? "Saved." : "Project added.");
    close();
  };
  const remove = () => update((s) => {
    s.projects = s.projects.filter((p) => p.id !== project!.id);
    s.steps = s.steps.filter((x) => x.projectId !== project!.id);
    s.pages = s.pages.filter((x) => x.projectId !== project!.id);
  });
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet title={project ? "Edit project" : "New project"} sub={project ? undefined : "Keep it light: a name and the very next step."} onClose={close}>
      <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch the newsletter" autoFocus={!project} /></div>
      <div className="field"><label htmlFor="p-why">Why it matters <span className="opt">optional</span></label><input id="p-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Build an audience before the product" /></div>
      {!project && <div className="field"><label htmlFor="p-first">Very next step <span className="opt">optional</span></label><input id="p-first" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Write 5 headline ideas" /></div>}
      <div className="field"><span>Area</span><Chips options={categoriesOf(state).map((c) => ({ key: c.key, label: `${c.emoji} ${c.label}`, color: `var(--c-${c.key})` }))} value={area} onChange={setArea} /></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions">
        {project && (confirm
          ? <button className="btn ghost" onClick={() => { remove(); close(); }}>Delete everything in it?</button>
          : <button className="btn ghost" onClick={() => setConfirm(true)}>Delete project</button>)}
        <span className="spacer" />
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

const KIND_LABEL: Record<Page["kind"], string> = { journal: "Journal entry", draft: "Draft", goal: "Goal" };

/** Write or edit a journal entry, a draft or a goal. Saves as you go. */
export function PageSheet({ page, projectId, kind }: { page?: Page; projectId: string; kind: Page["kind"] }) {
  const { update, close } = useApp();
  const [id] = useState(page?.id || uid());
  const [title, setTitle] = useState(page?.title || "");
  const [text, setText] = useState(page?.text || "");
  const [target, setTarget] = useState(page?.target || "");
  const exists = !!page;

  const save = (patch: Partial<Page>) => update((s) => {
    const cur = s.pages.find((x) => x.id === id);
    const next = { title: title.trim() || undefined, text, target: target || undefined, ...patch, updated: nowIso() };
    if (cur) Object.assign(cur, next);
    else if ((next.text || "").trim() || next.title) s.pages.push({ id, projectId, kind, created: nowIso(), ...next, text: next.text || "" });
  });
  const remove = () => { update((s) => { s.pages = s.pages.filter((x) => x.id !== id); }); close(); };

  return (
    <Sheet title={exists ? KIND_LABEL[kind] : `New ${KIND_LABEL[kind].toLowerCase()}`} onClose={() => { save({}); close(); }}
      sub={kind === "journal" ? new Date(page?.created || Date.now()).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : "Saves as you type."}>
      {kind !== "journal" && (
        <div className="field"><label htmlFor="pg-title">{kind === "goal" ? "Goal" : "Title"}</label>
          <input id="pg-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save({})} placeholder={kind === "goal" ? "1,000 subscribers" : "Landing page copy"} autoFocus={!exists} /></div>
      )}
      {kind === "goal" && (
        <div className="field"><label htmlFor="pg-target">By when <span className="opt">optional</span></label>
          <input id="pg-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={() => save({})} /></div>
      )}
      <div className="field"><label htmlFor="pg-text">{kind === "goal" ? "Why, and how you'll know" : kind === "journal" ? "What's on your mind?" : "Draft"} {kind === "goal" && <span className="opt">optional</span>}</label>
        <textarea id="pg-text" className="writer" rows={kind === "draft" ? 14 : 8} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => save({})} autoFocus={exists || kind === "journal"} /></div>
      <div className="actions">
        {exists && <button className="btn ghost" onClick={remove}>Delete</button>}
        <span className="spacer" />
        <button className="btn primary" onClick={() => { save({}); close(); }}>Done</button>
      </div>
    </Sheet>
  );
}

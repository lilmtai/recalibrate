import { useState, type CSSProperties } from "react";
import { useApp } from "../ctx";
import { CAT_LABEL } from "../constants";
import type { Page, Project, Step } from "../types";
import { today, uid } from "../lib/time";
import { activeProjects, JOURNAL, nextStep, nowIso, pagesOf, shortDate, stepsOf } from "../lib/work";
import { Icon } from "./Icon";

/**
 * Work: projects, their next steps, a journal, drafts and goals.
 * ADHD-friendly: one next step per project up front, quick capture, everything else one tap away.
 */
export function WorkView() {
  const { state } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const project = state.projects.find((p) => p.id === openId);
  if (project) return <ProjectView project={project} onBack={() => setOpenId(null)} />;
  return <WorkHome onOpen={setOpenId} />;
}

function WorkHome({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, update, open, celebrate, toast } = useApp();
  const active = activeProjects(state);
  const others = state.projects.filter((p) => p.status !== "active");
  const [showOthers, setShowOthers] = useState(false);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string>(JOURNAL);
  const [as, setAs] = useState<"step" | "note">("note");
  const journal = pagesOf(state, JOURNAL, "journal").slice(0, 3);

  const capture = () => {
    const t = text.trim();
    if (!t) return;
    update((s) => {
      if (as === "step" && target !== JOURNAL) {
        const order = Math.max(0, ...s.steps.filter((x) => x.projectId === target).map((x) => x.order)) + 1;
        s.steps.push({ id: uid(), projectId: target, text: t, done: false, order });
      } else {
        s.pages.push({ id: uid(), projectId: target, kind: target === JOURNAL ? "journal" : "draft", text: t, created: nowIso() });
      }
    });
    setText("");
    toast(as === "step" && target !== JOURNAL ? "Step added." : "Captured.");
  };
  const tick = (st: Step) => {
    update((s) => { const x = s.steps.find((y) => y.id === st.id)!; x.done = true; x.doneAt = today(); x.next = false; });
    celebrate();
  };

  return (
    <div className="work">
      {active.length > 0 && (
        <section className="card focus">
          <h2>Next steps</h2>
          <ul className="focuslist">
            {active.map((p) => {
              const st = nextStep(state, p.id);
              return (
                <li key={p.id} style={{ "--c": `var(--c-${p.area})` } as CSSProperties}>
                  {st ? <input type="checkbox" checked={false} onChange={() => tick(st)} aria-label={`Done: ${st.text}`} /> : <span className="nocheck" />}
                  <button className="grow focustext" onClick={() => onOpen(p.id)}>
                    <span className="projtag"><span className="swatch" />{p.name}</span>
                    <span className="steptext">{st ? st.text : "No next step yet. Tap to add one."}</span>
                  </button>
                  {st && <button className="btn small" onClick={() => open({ type: "block", date: today(), title: st.text })}>Plan it</button>}
                </li>
              );
            })}
          </ul>
          {active.length > 3 && <div className="hint">You have {active.length} active projects. Pausing some keeps your focus sharp; three is plenty.</div>}
        </section>
      )}

      <section className="card capture">
        <h2>Capture</h2>
        <div className="quickadd">
          <input id="cap" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="A thought, an idea, a task…" aria-label="Capture" />
          <button className="btn primary" disabled={!text.trim()} onClick={capture}>Add</button>
        </div>
        <div className="chips">
          <button className="pick" aria-pressed={target === JOURNAL} onClick={() => setTarget(JOURNAL)}>Journal</button>
          {active.map((p) => <button key={p.id} className="pick" aria-pressed={target === p.id} onClick={() => setTarget(p.id)}>{p.name}</button>)}
        </div>
        {target !== JOURNAL && (
          <div className="seg" role="group" style={{ marginTop: 8 }}>
            <button aria-pressed={as === "note"} onClick={() => setAs("note")}>As a note</button>
            <button aria-pressed={as === "step"} onClick={() => setAs("step")}>As a step</button>
          </div>
        )}
      </section>

      <div className="sechead" style={{ marginTop: 6 }}>
        <h2>Projects</h2>
        <button className="btn primary small" onClick={() => open({ type: "project" })}>New project</button>
      </div>
      {!state.projects.length ? (
        <div className="card empty"><div className="what">Start with one project</div><div>Give it a name and the very next step. That's enough to begin.</div></div>
      ) : (
        <div className="projgrid">
          {active.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />)}
        </div>
      )}
      {others.length > 0 && (
        <>
          <button className="btn ghost small" onClick={() => setShowOthers(!showOthers)}>{showOthers ? "Hide" : "Show"} paused and finished ({others.length})</button>
          {showOthers && <div className="projgrid">{others.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />)}</div>}
        </>
      )}

      <section className="card">
        <div className="sechead">
          <h2>Journal</h2>
          <button className="btn small" onClick={() => open({ type: "page", projectId: JOURNAL, kind: "journal" })}>Write</button>
        </div>
        {!journal.length ? <div className="small muted">How did today go? What's on your mind? Two lines is enough.</div> : (
          <ul className="pagelist">
            {journal.map((pg) => <PageRow key={pg.id} pg={pg} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const { state } = useApp();
  const steps = stepsOf(state, p.id);
  const done = steps.filter((x) => x.done).length;
  const st = nextStep(state, p.id);
  const drafts = pagesOf(state, p.id, "draft").length;
  const goals = pagesOf(state, p.id, "goal").filter((g) => !g.achieved).length;
  return (
    <button className="card projcard" style={{ "--c": `var(--c-${p.area})` } as CSSProperties} onClick={onOpen}>
      <div className="projtop"><span className="small muted">{CAT_LABEL[p.area]}</span>{p.status !== "active" && <span className="chip">{p.status === "paused" ? "Paused" : "Finished"}</span>}</div>
      <div className="projname">{p.name}</div>
      {p.why && <div className="small muted projwhy">{p.why}</div>}
      <div className="projnext"><b>Next:</b> {st ? st.text : "add a step"}</div>
      {steps.length > 0 && <div className="bar"><i style={{ width: `${(done / steps.length) * 100}%`, background: "var(--c)" }} /></div>}
      <div className="small muted">{done}/{steps.length} steps{drafts ? ` · ${drafts} draft${drafts > 1 ? "s" : ""}` : ""}{goals ? ` · ${goals} goal${goals > 1 ? "s" : ""}` : ""}</div>
    </button>
  );
}

function PageRow({ pg }: { pg: Page }) {
  const { open } = useApp();
  return (
    <li>
      <button className="pagerow" onClick={() => open({ type: "page", page: pg, projectId: pg.projectId, kind: pg.kind })}>
        <span className="small muted">{shortDate(pg.updated || pg.created)}</span>
        {pg.title && <b>{pg.title}</b>}
        <span className="excerpt">{pg.text}</span>
      </button>
    </li>
  );
}

type Section = "steps" | "journal" | "draft" | "goal";

function ProjectView({ project: p, onBack }: { project: Project; onBack: () => void }) {
  const { state, update, open, celebrate } = useApp();
  const [sec, setSec] = useState<Section>("steps");
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const steps = stepsOf(state, p.id);
  const openSteps = steps.filter((x) => !x.done);
  const doneSteps = steps.filter((x) => x.done);
  const nxt = nextStep(state, p.id);
  const count = (k: Page["kind"]) => pagesOf(state, p.id, k).length;

  const addStep = () => {
    const t = text.trim();
    if (!t) return;
    update((s) => { s.steps.push({ id: uid(), projectId: p.id, text: t, done: false, order: Math.max(0, ...s.steps.filter((x) => x.projectId === p.id).map((x) => x.order)) + 1 }); });
    setText("");
  };
  const toggle = (st: Step) => {
    update((s) => { const x = s.steps.find((y) => y.id === st.id)!; x.done = !x.done; x.doneAt = x.done ? today() : undefined; if (x.done) x.next = false; });
    if (!st.done) celebrate();
  };
  const pin = (st: Step) => update((s) => { for (const x of s.steps) if (x.projectId === p.id) x.next = x.id === st.id; });
  const moveStep = (st: Step, dir: -1 | 1) => update((s) => {
    const list = s.steps.filter((x) => x.projectId === p.id && !x.done).sort((a, b) => a.order - b.order);
    const i = list.findIndex((x) => x.id === st.id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
  });
  const removeStep = (st: Step) => update((s) => { s.steps = s.steps.filter((x) => x.id !== st.id); });
  const rename = (st: Step, t: string) => update((s) => { const x = s.steps.find((y) => y.id === st.id); if (x && t.trim()) x.text = t.trim(); });
  const setStatus = (status: Project["status"]) => update((s) => { s.projects.find((x) => x.id === p.id)!.status = status; });

  return (
    <div className="work" style={{ "--c": `var(--c-${p.area})` } as CSSProperties}>
      <div className="daynav"><button className="btn ghost small" onClick={onBack}><Icon name="back" size={16} /> All projects</button></div>
      <section className="card projhead">
        <div className="projtop"><span className="small muted">{CAT_LABEL[p.area]}</span><button className="btn small" onClick={() => open({ type: "project", project: p })}>Edit</button></div>
        <div className="projname big">{p.name}</div>
        {p.why && <div className="muted">{p.why}</div>}
        <div className="seg" role="group" style={{ marginTop: 12 }}>
          {(["active", "paused", "done"] as const).map((k) => <button key={k} aria-pressed={p.status === k} onClick={() => setStatus(k)}>{k === "active" ? "Active" : k === "paused" ? "Paused" : "Finished"}</button>)}
        </div>
      </section>

      <div className="subnav" role="group">
        {([["steps", `Steps ${openSteps.length || ""}`], ["journal", `Journal ${count("journal") || ""}`], ["draft", `Drafts ${count("draft") || ""}`], ["goal", `Goals ${count("goal") || ""}`]] as [Section, string][]).map(([k, l]) => (
          <button key={k} aria-pressed={sec === k} onClick={() => setSec(k)}>{l.trim()}</button>
        ))}
      </div>

      {sec === "steps" && (
        <section className="card">
          <div className="quickadd" style={{ marginTop: 0 }}>
            <input id="step-new" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStep()} placeholder="Add a step (small and concrete)" aria-label="New step" />
            <button className="btn primary" disabled={!text.trim()} onClick={addStep}>Add</button>
          </div>
          <ul className="steplist">
            {openSteps.map((st, i) => (
              <li key={st.id} className={nxt?.id === st.id ? "isnext" : ""}>
                <input type="checkbox" checked={false} onChange={() => toggle(st)} aria-label={`Done: ${st.text}`} />
                <input className="grow stepedit" defaultValue={st.text} onBlur={(e) => rename(st, e.target.value)} aria-label="Step" />
                <span className="stepacts">
                  {nxt?.id === st.id ? <span className="chip gold">Next</span> : <button className="iconbtn" title="Make this the next step" aria-label="Make this the next step" onClick={() => pin(st)}><Icon name="sparkle" size={16} /> Next</button>}
                  <button className="iconbtn" aria-label="Move up" disabled={i === 0} onClick={() => moveStep(st, -1)}>↑</button>
                  <button className="iconbtn" aria-label="Move down" disabled={i === openSteps.length - 1} onClick={() => moveStep(st, 1)}>↓</button>
                  <button className="iconbtn" aria-label="Plan it" title="Give it a time today" onClick={() => open({ type: "block", date: today(), title: st.text })}><Icon name="calendar" size={16} /> Plan</button>
                  <button className="iconbtn" aria-label="Delete step" onClick={() => removeStep(st)}>×</button>
                </span>
              </li>
            ))}
          </ul>
          {!openSteps.length && <div className="small muted" style={{ marginTop: 10 }}>What's the very next thing you could do in 25 minutes?</div>}
          {doneSteps.length > 0 && (
            <>
              <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setShowDone(!showDone)}>{showDone ? "Hide" : "Show"} {doneSteps.length} done</button>
              {showDone && (
                <ul className="steplist done">
                  {doneSteps.map((st) => (
                    <li key={st.id}><input type="checkbox" checked onChange={() => toggle(st)} aria-label={`Not done: ${st.text}`} /><span className="grow">{st.text}</span><span className="small muted">{st.doneAt}</span></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {sec !== "steps" && (
        <section className="card">
          <div className="sechead">
            <h2>{sec === "journal" ? "Journal" : sec === "draft" ? "Drafts" : "Goals"}</h2>
            <button className="btn primary small" onClick={() => open({ type: "page", projectId: p.id, kind: sec })}>{sec === "journal" ? "Write" : sec === "draft" ? "New draft" : "New goal"}</button>
          </div>
          {sec === "goal" ? <GoalList projectId={p.id} /> : (
            <ul className="pagelist">
              {pagesOf(state, p.id, sec).map((pg) => <PageRow key={pg.id} pg={pg} />)}
              {!pagesOf(state, p.id, sec).length && <li className="small muted">{sec === "journal" ? "Progress, blockers, wins. Short is fine." : "Ideas, outlines, half-finished thoughts. Nothing has to be perfect here."}</li>}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function GoalList({ projectId }: { projectId: string }) {
  const { state, update, open, celebrate } = useApp();
  const goals = pagesOf(state, projectId, "goal").sort((a, b) => Number(!!a.achieved) - Number(!!b.achieved) || (a.target || "9").localeCompare(b.target || "9"));
  if (!goals.length) return <div className="small muted">What does “done” look like? Add one goal with a date.</div>;
  return (
    <ul className="steplist">
      {goals.map((g) => (
        <li key={g.id}>
          <input type="checkbox" checked={!!g.achieved} onChange={() => { update((s) => { const x = s.pages.find((y) => y.id === g.id)!; x.achieved = !x.achieved; x.updated = nowIso(); }); if (!g.achieved) celebrate(); }} aria-label={`Achieved: ${g.title || g.text}`} />
          <button className="grow pagerow inline" onClick={() => open({ type: "page", page: g, projectId, kind: "goal" })}>
            <b style={{ textDecoration: g.achieved ? "line-through" : undefined }}>{g.title || g.text}</b>
          </button>
          {g.target && <span className={`chip ${!g.achieved && g.target < today() ? "warn" : ""}`}>{g.target}</span>}
        </li>
      ))}
    </ul>
  );
}

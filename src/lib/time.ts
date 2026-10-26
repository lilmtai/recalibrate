export const pad = (n: number) => String(n).padStart(2, "0");
export const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dkey(new Date());
export const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
};
/** 0 = Monday … 6 = Sunday */
export const weekday = (k: string) => (parseKey(k).getDay() + 6) % 7;
export const weekStart = (k: string) => addDays(k, -weekday(k));
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
export const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
export const fmtDur = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`;
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const longDate = (k: string) =>
  parseKey(k).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
export const uid = () => Math.random().toString(36).slice(2, 10);
export const norm = (s: string) => s.toLowerCase().trim();

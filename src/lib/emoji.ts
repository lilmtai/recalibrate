import { catOf } from "../constants";
import type { Category } from "../types";

/** Title words → emoji. First match wins, so more specific words come first. */
const RULES: [RegExp, string][] = [
  [/\b(gym|lift|weights|workout|training|crossfit)\b/i, "🏋️"],
  [/\b(run|running|jog)\b/i, "🏃"],
  [/\b(walk|hike)\b/i, "🚶"],
  [/\b(yoga|stretch|pilates)\b/i, "🧘"],
  [/\b(meditat\w*|breath\w*)\b/i, "🧘"],
  [/\b(swim\w*)\b/i, "🏊"],
  [/\b(bike|cycl\w*)\b/i, "🚴"],
  [/\b(cook\w*|meal prep|bake|baking)\b/i, "🍳"],
  [/\b(breakfast)\b/i, "🥐"],
  [/\b(lunch)\b/i, "🥗"],
  [/\b(dinner|supper)\b/i, "🍽️"],
  [/\b(coffee|café|cafe)\b/i, "☕"],
  [/\b(clean\w*|tidy|vacuum|laundry|dishes)\b/i, "🧹"],
  [/\b(groceries|grocery|shopping|supermarket)\b/i, "🛒"],
  [/\b(barber|haircut|hair)\b/i, "💈"],
  [/\b(doctor|dentist|therapy|therapist|appointment|clinic)\b/i, "🩺"],
  [/\b(meds|medication|pills)\b/i, "💊"],
  [/\b(shower|bath)\b/i, "🚿"],
  [/\b(sleep|nap|bed)\b/i, "😴"],
  [/\b(meeting|standup|stand-up|sync|1:1|interview)\b/i, "📅"],
  [/\b(call|phone)\b/i, "📞"],
  [/\b(email|emails|inbox|mail)\b/i, "📧"],
  [/\b(admin|taxes|tax|bills|paperwork|invoice\w*)\b/i, "🗂️"],
  [/\b(code|coding|dev|build|debug)\b/i, "💻"],
  [/\b(deep work|focus|strategy|research)\b/i, "🧠"],
  [/\b(write|writing|draft|journal|newsletter|blog)\b/i, "✍️"],
  [/\b(read|reading|book)\b/i, "📖"],
  [/\b(study|course|learn\w*|class|lesson)\b/i, "📚"],
  [/\b(plan|planning|review)\b/i, "🗒️"],
  [/\b(commute|drive|driving|car|train|bus)\b/i, "🚗"],
  [/\b(travel|flight|airport)\b/i, "✈️"],
  [/\b(friends?|party|drinks|date)\b/i, "🥂"],
  [/\b(family|kids|mum|mom|dad|parents)\b/i, "👨‍👩‍👧"],
  [/\b(music|guitar|piano|practice)\b/i, "🎸"],
  [/\b(game|gaming)\b/i, "🎮"],
  [/\b(movie|film|series|netflix|tv)\b/i, "🎬"],
  [/\b(pray\w*|prayer|church|mosque)\b/i, "🙏"],
  [/\b(invest\w*|trading|crypto|stocks|budget|finance)\b/i, "📈"],
];

/** Suggested emoji for a block: from its title, else its category's emoji. */
export function suggestEmoji(title: string, category: string | undefined, s: { categories?: Category[] }): string {
  for (const [re, e] of RULES) if (re.test(title)) return e;
  return catOf(s, category).emoji;
}

/** A small palette for picking by hand. */
export const EMOJI_PICKS = [
  "💼", "🧠", "💻", "📧", "📅", "📞", "✍️", "📖", "📚", "🗂️", "📈", "🚀",
  "🏋️", "🏃", "🚶", "🧘", "🏊", "🚴", "🍳", "🥗", "🍽️", "☕", "🛒", "🧹",
  "💈", "🩺", "💊", "🚿", "😴", "🚗", "✈️", "🥂", "👨‍👩‍👧", "🎸", "🎮", "🎬",
  "🙏", "🗒️", "🎯", "⭐", "🌱", "🐶",
];

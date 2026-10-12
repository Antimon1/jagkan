import { childAge } from '../domain/age';
import { findTemplate } from '../domain/catalog';
import { BRANCHES } from '../domain/constants';
import { sanitizeAiChallenge } from '../domain/handlers/ai';
import type { AiChallengePayload, BranchId, Catalog, Child, FamilyState } from '../domain/types';

/**
 * Prompts and output validation for the AI features (spec 8). Only first name and
 * age ever leave the server: never photos, last names or other family members.
 */

const SCHEMA_HINT = `{"titleChild": "kort titel till barnet (max 60 tecken)", "titleParent": "tydlig titel till föräldern (max 120 tecken)", "branch": "${BRANCHES.join('|')}", "icon": "en emoji", "parentTip": "ett konkret tips till föräldern (max 300 tecken)", "difficulty": 1, "repeatable": false, "ageMin": 4, "ageMax": 6}`;

const SAFETY_RULES = `Regler:
- Utmaningarna ska vara säkra, passa barnets ålder och gå att göra hemma eller i närheten av hemmet.
- Föreslå aldrig något farligt. Spis, ugn, kniv, eld, tändstickor och elverktyg får bara förekomma om en vuxen uttryckligen är med, och aldrig för barn under 8 år.
- Skriv på svenska, varmt och positivt. Uttryck aldrig förlust, misslyckande eller straff.
- Svara endast med JSON, utan förklarande text.`;

export const WEEKLY_SYSTEM_PROMPT = `Du hjälper föräldrar att hitta nya vardagsutmaningar som gör barn mer självständiga i appen JagKan!.
Svara med ett JSON-objekt {"challenges": [...]} där varje utmaning följer schemat ${SCHEMA_HINT}.
Grenarna betyder: kropp = kropp och hygien, mat = mat och kök, hem = hem och ordning, ute = ute och trafik, pengar = pengar och handla, kanslor = känslor och relationer, mod = mod och nya saker.
${SAFETY_RULES}`;

export const CUSTOM_SYSTEM_PROMPT = `Du hjälper en förälder att formulera en egen utmaning i appen JagKan! utifrån en beskrivning av en situation.
Svara med ett JSON-objekt {"challenge": {...}} som följer schemat ${SCHEMA_HINT}.
${SAFETY_RULES}`;

export const CARD_SYSTEM_PROMPT = `Du skriver texten på ett samlarkort i barnappen JagKan! när ett barn har klarat en utmaning.
Skriv 2–3 korta meningar på svenska i tredje person, med varm och stolt ton. Använd barnets förnamn men inga pronomen (vi vet inte barnets kön).
Uttryck aldrig förlust eller misslyckande. Svara endast med kortets text, utan citattecken.`;

const MAX_HISTORY = 30;

interface ChallengeLine {
  title: string;
  branch: BranchId;
}

function titleOf(catalog: Catalog, templateId: string | null, customTitle: string | null): string {
  return findTemplate(catalog, templateId)?.titleChild ?? customTitle ?? '';
}

/** Spec 8 input for weekly suggestions: age, world, done and active challenges, missing branches. */
export function buildWeeklyPrompt(state: FamilyState, child: Child, catalog: Catalog, nowIso: string, count: number): string {
  const mine = state.challenges.filter((c) => c.childId === child.id);
  const line = (c: (typeof mine)[number]): ChallengeLine => ({ title: titleOf(catalog, c.templateId, c.customTitle), branch: c.branch });
  const completed = mine.filter((c) => c.status === 'completed' || c.repeatCount > 0).slice(-MAX_HISTORY).map(line);
  const active = mine.filter((c) => c.status === 'active' || c.status === 'requested' || c.status === 'suggested').map(line);
  const usedBranches = new Set(mine.map((c) => c.branch));
  const missing = BRANCHES.filter((b) => !usedBranches.has(b));
  const pending = state.aiSuggestions.filter((s) => s.childId === child.id && s.status === 'new').map((s) => s.payload.titleChild);
  return JSON.stringify({
    uppgift: `Föreslå ${count} nya utmaningar för barnet.`,
    alder: childAge(child, nowIso, state.family.settings.timeZone),
    varld: child.world,
    klarade: completed,
    aktiva: active,
    redanForeslagna: pending,
    grenarSomSaknas: missing,
  });
}

export function buildCustomPrompt(age: number, description: string): string {
  return JSON.stringify({ alder: age, beskrivning: description.trim().slice(0, 500) });
}

export interface CardPromptInput {
  firstName: string;
  title: string;
  parentNote: string | null;
  attempts: number;
}

export function buildCardPrompt(input: CardPromptInput): string {
  return JSON.stringify({
    fornamn: input.firstName,
    utmaning: input.title,
    foralderns_kommentar: input.parentNote ?? '',
    antal_forsok: input.attempts,
  });
}

/** Pull the first JSON value out of a model answer (tolerates ```json fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  if (end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

const RISKY = /kniv|spis|ugn|tändsticka|tändstickor|stearinljus|\beld\b|elverktyg|grill/i;
const WITH_ADULT = /vuxen|vuxna|förälder|mamma|pappa/i;
export const ADULT_ONLY_RISK_AGE = 8;

/** Extra safety net on top of the system prompt (spec 8). */
export function isSafeForAge(payload: AiChallengePayload, age: number): boolean {
  const text = `${payload.titleChild} ${payload.titleParent} ${payload.parentTip}`;
  if (!RISKY.test(text)) return true;
  return age >= ADULT_ONLY_RISK_AGE && WITH_ADULT.test(text);
}

function fitsAge(payload: AiChallengePayload, age: number): boolean {
  return age >= payload.ageMin && age <= payload.ageMax;
}

/**
 * Validate a weekly-suggestions answer against the seed schema. Returns null when
 * anything is off, so the caller falls back to the library (spec 8).
 */
export function parseChallenges(text: string, age: number, count: number): AiChallengePayload[] | null {
  const json = extractJson(text);
  const list = Array.isArray(json) ? json : (json as { challenges?: unknown } | null)?.challenges;
  if (!Array.isArray(list) || list.length === 0) return null;
  const items = list.slice(0, count).map(sanitizeAiChallenge);
  if (items.some((item) => item === null)) return null;
  const valid = items as AiChallengePayload[];
  if (!valid.every((item) => fitsAge(item, age) && isSafeForAge(item, age))) return null;
  const titles = new Set(valid.map((item) => item.titleChild.toLocaleLowerCase('sv-SE')));
  return titles.size === valid.length ? valid : null;
}

export function parseCustomChallenge(text: string, age: number): AiChallengePayload | null {
  const json = extractJson(text) as { challenge?: unknown } | null;
  const item = sanitizeAiChallenge(json && typeof json === 'object' && 'challenge' in json ? json.challenge : json);
  return item && isSafeForAge(item, age) ? item : null;
}

const NEGATIVE = /förlor|misslyck|\bfel\b|dålig|straff|tappa|förstör|\bsämst\b/i;
export const MAX_CARD_TEXT = 400;

/** Clean an AI card text; null means "use the template text instead". */
export function cleanCardText(text: string, firstName: string): string | null {
  const cleaned = text.trim().replace(/^["“”']+|["“”']+$/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > MAX_CARD_TEXT) return null;
  if (NEGATIVE.test(cleaned) || !cleaned.includes(firstName)) return null;
  return cleaned;
}

import {
  HIDDEN_STAT_KEYS,
  REGION_KEYS,
  STAT_KEYS,
  isAdvisorId,
  type AdvisorId,
  type GameOverReason,
  type GameState,
  type HiddenStats,
  type RegionLoyaltyByRegion,
  type Stats,
  type StatBuffers,
} from '../types';
import { HIDDEN_STAT_DEFAULT, clampHiddenStat, createInitialHiddenStats } from './hiddenStats';

const STORAGE_KEY = 'fra-sim-state-v5';
const LEGACY_STORAGE_KEY = 'fra-sim-state-v4';
const INTRO_DISMISSED_KEY = 'fra-sim-intro-dismissed-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampCapital(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

function parseStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || !raw.every((entry) => typeof entry === 'string')) {
    return null;
  }
  return raw;
}

function parseStats(raw: unknown): Stats | null {
  if (!isRecord(raw)) {
    return null;
  }

  const parsed = {} as Stats;
  for (const key of STAT_KEYS) {
    const value = raw[key];
    if (typeof value !== 'number') {
      return null;
    }
    parsed[key] = key === 'capital' ? clampCapital(value) : clamp(value);
  }
  return parsed;
}

function parseStatBuffers(raw: unknown): StatBuffers | null {
  if (!isRecord(raw)) {
    return null;
  }

  const parsed = {} as StatBuffers;
  for (const key of STAT_KEYS) {
    const value = raw[key];
    if (typeof value !== 'number') {
      return null;
    }
    parsed[key] = Math.max(0, value); // Buffers are never negative
  }
  return parsed;
}

function parseRegionLoyalty(raw: unknown): RegionLoyaltyByRegion | null {
  if (!isRecord(raw)) {
    return null;
  }

  const parsed = {} as RegionLoyaltyByRegion;
  for (const region of REGION_KEYS) {
    const value = raw[region];
    if (typeof value !== 'number') {
      return null;
    }
    parsed[region] = clamp(value);
  }
  return parsed;
}

function parseHiddenStats(raw: unknown): HiddenStats | null {
  if (!isRecord(raw)) {
    return null;
  }

  const parsed = {} as HiddenStats;
  const collected: Partial<Record<(typeof HIDDEN_STAT_KEYS)[number], number>> = {};
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (!HIDDEN_STAT_KEYS.includes(rawKey as (typeof HIDDEN_STAT_KEYS)[number])) {
      continue;
    }
    if (typeof rawValue !== 'number') {
      return null;
    }
    collected[rawKey as (typeof HIDDEN_STAT_KEYS)[number]] = rawValue;
  }

  for (const key of HIDDEN_STAT_KEYS) {
    const value = collected[key];
    parsed[key] = clampHiddenStat(typeof value === 'number' ? value : HIDDEN_STAT_DEFAULT);
  }

  return parsed;
}

function isGameOverReason(value: unknown): value is Exclude<GameOverReason, null> {
  return (
    value === 'authority' ||
    value === 'capital' ||
    value === 'sentiment' ||
    value === 'sustainability' ||
    value === 'no_confidence' ||
    value === 'completed'
  );
}

export function saveGameState(game: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // Ignore storage write errors.
  }
}

export function loadGameState(): GameState | null {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const stats = parseStats(parsed.stats);
    const statBuffers = parseStatBuffers(parsed.statBuffers);
    const hiddenStats = parseHiddenStats(parsed.hiddenStats);
    const regionLoyalty = parseRegionLoyalty(parsed.regionLoyalty);
    const deck = parseStringArray(parsed.deck);
    const advisorId = parsed.advisorId;
    const turn = parsed.turn;
    const currentCardId = parsed.currentCardId;
    const headline = parsed.headline;
    const endingSummary = parsed.endingSummary;
    const gameOver = parsed.gameOver;
    const gameOverReason = parsed.gameOverReason;
    const malikCooldown = parsed.malikCooldown;
    const malikRewriteActive = parsed.malikRewriteActive;
    const pacifiedRegions = parsed.pacifiedRegions;
    const krossLastUsedElectionTerm = parsed.krossLastUsedElectionTerm;

    if (
      !stats ||
      !statBuffers ||
      !regionLoyalty ||
      !deck ||
      (parsed.hiddenStats !== undefined && parsed.hiddenStats !== null && !hiddenStats) ||
      (advisorId !== undefined && advisorId !== null && (typeof advisorId !== 'string' || !isAdvisorId(advisorId))) ||
      typeof turn !== 'number' ||
      (currentCardId !== null && currentCardId !== undefined && typeof currentCardId !== 'string') ||
      (headline !== null && headline !== undefined && typeof headline !== 'string') ||
      (endingSummary !== null && endingSummary !== undefined && typeof endingSummary !== 'string') ||
      typeof gameOver !== 'boolean' ||
      (gameOverReason !== null && !isGameOverReason(gameOverReason))
    ) {
      return null;
    }

    return {
      advisorId: typeof advisorId === 'string' && isAdvisorId(advisorId) ? (advisorId as AdvisorId) : null,
      stats,
      statBuffers,
      hiddenStats: hiddenStats ?? createInitialHiddenStats(),
      regionLoyalty,
      turn: Math.max(0, Math.floor(turn)),
      deck,
      currentCardId: typeof currentCardId === 'string' ? currentCardId : null,
      headline: typeof headline === 'string' ? headline : null,
      endingSummary: typeof endingSummary === 'string' ? endingSummary : null,
      gameOver,
      gameOverReason: gameOverReason ?? null,
      malikCooldown: typeof malikCooldown === 'number' ? malikCooldown : 0,
      malikRewriteActive: typeof malikRewriteActive === 'boolean' ? malikRewriteActive : false,
      pacifiedRegions: Array.isArray(pacifiedRegions) ? pacifiedRegions : [],
      krossLastUsedElectionTerm: typeof krossLastUsedElectionTerm === 'number' ? krossLastUsedElectionTerm : null,
      santanaLastUsedElectionTerm: typeof parsed.santanaLastUsedElectionTerm === 'number' ? parsed.santanaLastUsedElectionTerm : null,
      santanaLastUsedTurn: typeof parsed.santanaLastUsedTurn === 'number' ? parsed.santanaLastUsedTurn : null,
      martialLawActive: typeof parsed.martialLawActive === 'boolean' ? parsed.martialLawActive : false,
    };
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage delete errors.
  }
}

export function loadIntroDismissed(): boolean {
  try {
    return localStorage.getItem(INTRO_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveIntroDismissed(): void {
  try {
    localStorage.setItem(INTRO_DISMISSED_KEY, '1');
  } catch {
    // Ignore storage write errors.
  }
}

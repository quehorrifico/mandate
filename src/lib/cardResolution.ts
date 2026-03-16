import {
  REGION_KEYS,
  normalizeCardTagKey,
  normalizeRegionKey,
  normalizeStatKey,
  type Card,
  type CardChoice,
  type Direction,
  type GameState,
  type RawCard,
  type RegionKey,
  type RegionLoyaltyByRegion,
  type Stats,
  normalizeHiddenStatKey,
  type StatBuffers,
  STAT_KEYS,
} from '../types';
import { applyHiddenStatEffects } from './hiddenStats';

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampCapital(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

function normalizeEffectsRecord(raw: unknown): NonNullable<CardChoice['effects']> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const normalized: NonNullable<CardChoice['effects']> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number') {
      continue;
    }
    const mappedKey = normalizeStatKey(key);
    if (!mappedKey) {
      continue;
    }
    normalized[mappedKey] = (normalized[mappedKey] ?? 0) + value;
  }

  return normalized;
}

function normalizeRegionalEffectsRecord(raw: unknown): NonNullable<CardChoice['regionalEffects']> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const normalized: NonNullable<CardChoice['regionalEffects']> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number') {
      continue;
    }
    const mappedKey = normalizeRegionKey(key);
    if (!mappedKey) {
      continue;
    }
    normalized[mappedKey] = (normalized[mappedKey] ?? 0) + value;
  }

  return normalized;
}

function normalizeHiddenEffectsRecord(raw: unknown): NonNullable<CardChoice['hiddenEffects']> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const normalized: NonNullable<CardChoice['hiddenEffects']> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number') {
      continue;
    }
    const mappedKey = normalizeHiddenStatKey(key);
    if (!mappedKey) {
      continue;
    }
    normalized[mappedKey] = (normalized[mappedKey] ?? 0) + value;
  }

  return normalized;
}

function normalizeCardChoice(choice: CardChoice): CardChoice {
  return {
    ...choice,
    effects: normalizeEffectsRecord(choice.effects),
    treasuryDelta: typeof choice.treasuryDelta === 'number' ? choice.treasuryDelta : undefined,
    regionalEffects: normalizeRegionalEffectsRecord(choice.regionalEffects),
    hiddenEffects: normalizeHiddenEffectsRecord(choice.hiddenEffects),
  };
}

/**
 * Converts authored card data into canonical runtime shape.
 * Backward compatibility:
 * - existing left/right cards are kept as-is
 * - yes/no cards are mapped to left=no and right=yes
 */
export function normalizeCard(rawCard: RawCard): Card | null {
  const useLeftRight = rawCard.left && rawCard.right;
  const useYesNo = rawCard.yes && rawCard.no;

  if (!useLeftRight && !useYesNo) {
    return null;
  }

  const left = normalizeCardChoice((useLeftRight ? rawCard.left : rawCard.no) as CardChoice);
  const right = normalizeCardChoice((useLeftRight ? rawCard.right : rawCard.yes) as CardChoice);
  const governor =
    typeof rawCard.governor === 'string' ? normalizeRegionKey(rawCard.governor) ?? undefined : undefined;

  const targetRegions = rawCard.targetRegions
    ?.map((region) => normalizeRegionKey(region))
    .filter((region): region is RegionKey => Boolean(region));

  const pillarTags = rawCard.pillarTags
    ?.map((tag) => normalizeCardTagKey(tag))
    .filter((pillar): pillar is NonNullable<typeof pillar> => Boolean(pillar));

  return {
    id: rawCard.id,
    kind: 'policy',
    type: rawCard.type,
    governor,
    targetRegions: targetRegions && targetRegions.length > 0 ? targetRegions : undefined,
    pillarTags: pillarTags && pillarTags.length > 0 ? pillarTags : undefined,
    tier: rawCard.tier,
    category: rawCard.category,
    path: rawCard.path,
    prompt: rawCard.prompt,
    left,
    right,
  };
}

export function getCardChoice(card: Card, direction: Direction): CardChoice {
  return direction === 'left' ? card.left : card.right;
}

export function applyChoiceToStats(
  stats: Stats,
  statBuffers: StatBuffers,
  choice: CardChoice,
): { stats: Stats; statBuffers: StatBuffers } {
  const effects = choice.effects ?? {};
  const treasuryDelta = choice.treasuryDelta ?? 0;

  const nextStats = { ...stats };
  const nextBuffers = { ...statBuffers };

  for (const key of STAT_KEYS) {
    let delta = effects[key] ?? 0;
    if (key === 'capital') {
      delta += treasuryDelta;
    }

    if (delta > 0) {
      // Fill stat first up to 100, excess to buffer
      const spaceInStat = 100 - nextStats[key];
      if (spaceInStat >= delta) {
        nextStats[key] += delta;
      } else {
        nextStats[key] = 100;
        nextBuffers[key] += delta - Math.max(0, spaceInStat);
      }
    } else if (delta < 0) {
      // Drain buffer first, then stat
      const absDelta = Math.abs(delta);
      if (nextBuffers[key] >= absDelta) {
        nextBuffers[key] -= absDelta;
      } else {
        const remainingDelta = absDelta - nextBuffers[key];
        nextBuffers[key] = 0;
        nextStats[key] -= remainingDelta;
      }
    }
  }

  // Final clamps for safety
  nextStats.authority = clampPercent(nextStats.authority);
  nextStats.capital = clampCapital(nextStats.capital);
  nextStats.sentiment = clampPercent(nextStats.sentiment);
  nextStats.sustainability = clampPercent(nextStats.sustainability);

  return { stats: nextStats, statBuffers: nextBuffers };
}

export function applyChoiceToRegionSupport(
  regionSupport: RegionLoyaltyByRegion,
  choice: CardChoice,
): RegionLoyaltyByRegion {
  const regionalEffects = choice.regionalEffects ?? {};
  if (Object.keys(regionalEffects).length === 0) {
    return regionSupport;
  }

  const next = { ...regionSupport };
  for (const region of REGION_KEYS) {
    const delta = regionalEffects[region] ?? 0;
    if (delta !== 0) {
      next[region] = clampPercent(next[region] + delta);
    }
  }
  return next;
}

function getNumericChanges<T extends string>(
  before: Record<T, number>,
  after: Record<T, number>,
): Array<{ key: T; before: number; after: number; delta: number }> {
  const changes: Array<{ key: T; before: number; after: number; delta: number }> = [];
  for (const key of Object.keys(before) as T[]) {
    const beforeValue = before[key];
    const afterValue = after[key];
    const delta = afterValue - beforeValue;
    if (delta !== 0) {
      changes.push({ key, before: beforeValue, after: afterValue, delta });
    }
  }
  return changes;
}

export interface DecisionResolutionChanges {
  visibleStatChanges: Array<{ key: keyof Stats; before: number; after: number; delta: number }>;
  bufferChanges: Array<{ key: keyof StatBuffers; before: number; after: number; delta: number }>;
  regionSupportChanges: Array<{ key: RegionKey; before: number; after: number; delta: number }>;
}

export interface DecisionResolutionResult {
  ok: boolean;
  reason?: string;
  choice: CardChoice;
  next: Pick<GameState, 'stats' | 'statBuffers' | 'hiddenStats' | 'regionLoyalty'>;
  changes: DecisionResolutionChanges;
  events: {
    targetRegions: RegionKey[];
    pillarTags: string[];
  };
}

export function resolveCardDecision(params: {
  state: Pick<GameState, 'stats' | 'statBuffers' | 'hiddenStats' | 'regionLoyalty' | 'malikRewriteActive' | 'pacifiedRegions'>;
  card: Card;
  direction: Direction;
}): DecisionResolutionResult {
  const { state, card, direction } = params;

  const rawChoice = getCardChoice(card, direction);
  const choice = { ...rawChoice }; // Shallow clone to prevent mutating the source card object
  
  if (state.malikRewriteActive) {
    // Left (DECLINE) does nothing. Right (ACCEPT) gives +15 Authority, +15 Sentiment, +25 Governor Loyalty.
    choice.effects = direction === 'right' ? { authority: 15, sentiment: 15 } : {};
    choice.treasuryDelta = 0;
    if (direction === 'right' && card.governor) {
      choice.regionalEffects = { [card.governor]: 25 };
    } else {
      choice.regionalEffects = {};
    }
  } else if (card.governor && state.pacifiedRegions.includes(card.governor)) {
    // Pacified regions' requests have zero effect
    choice.effects = {};
    choice.treasuryDelta = 0;
    choice.regionalEffects = {};
  }

  const { stats: nextStats, statBuffers: nextBuffers } = applyChoiceToStats(state.stats, state.statBuffers, choice);
  const nextRegionLoyalty = applyChoiceToRegionSupport(state.regionLoyalty, choice);
  const nextHiddenStats = applyHiddenStatEffects(state.hiddenStats, choice.hiddenEffects);

  return {
    ok: true,
    choice,
    next: {
      stats: nextStats,
      statBuffers: nextBuffers,
      hiddenStats: nextHiddenStats,
      regionLoyalty: nextRegionLoyalty,
    },
    changes: {
      visibleStatChanges: getNumericChanges(state.stats, nextStats),
      bufferChanges: getNumericChanges(state.statBuffers, nextBuffers),
      regionSupportChanges: getNumericChanges(state.regionLoyalty, nextRegionLoyalty),
    },
    events: {
      targetRegions: card.targetRegions ?? [],
      pillarTags: card.pillarTags ?? [],
    },
  };
}

export function getResolutionDebugSummary(resolution: DecisionResolutionResult): {
  ok: boolean;
  reason?: string;
  visibleStatChanges: DecisionResolutionChanges['visibleStatChanges'];
} {
  return {
    ok: resolution.ok,
    reason: resolution.reason,
    visibleStatChanges: resolution.changes.visibleStatChanges,
  };
}

export function logResolutionDebug(
  resolution: DecisionResolutionResult,
  meta?: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.debug('[resolution]', {
    ...meta,
    ...getResolutionDebugSummary(resolution),
  });
}

// Lightweight analytics helper for dev tooling and future balancing.
export function getCardTags(card: Card): string[] {
  const tags = new Set<string>();
  if (card.type) {
    tags.add(`type:${card.type}`);
  }
  for (const pillar of card.pillarTags ?? []) {
    tags.add(`pillar:${pillar}`);
  }
  for (const region of card.targetRegions ?? []) {
    tags.add(`target:${region}`);
  }
  if (card.path) {
    tags.add(`path:${card.path}`);
  }
  return [...tags];
}

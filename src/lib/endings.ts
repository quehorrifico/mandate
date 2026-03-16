import { HIDDEN_STAT_KEYS, type HiddenStats, type Stats, type PolicyPillarKey } from '../types';
import { LEGACY_PARAGRAPHS } from '../data/legacyParagraphs';
import { HIDDEN_STAT_TO_PILLAR } from './hiddenStats';
import {
  SINGLE_PILLAR_TITLES,
  DOUBLE_PILLAR_TITLES,
  TRIPLE_PILLAR_TITLES,
} from '../data/legacyTitles';

export const ENDING_AXES = [
  'SS',
  'GS',
  'GD',
  'HN',
  'MG',
  'IE',
  'LP',
  'FR',
  'NS',
  'TV',
] as const;

export type EndingAxis = (typeof ENDING_AXES)[number];

export interface EndingDefinition {
  title: string;
  summary: string;
}

export interface EndingResolution {
  primary: EndingAxis;
  secondary: EndingAxis;
  definition: EndingDefinition;
  scores: Record<EndingAxis, number>;
  modularLegacy: string;
}

const AXIS_SORT_ORDER: Record<EndingAxis, number> = {
  SS: 0,
  GS: 1,
  GD: 2,
  HN: 3,
  MG: 4,
  IE: 5,
  LP: 6,
  FR: 7,
  NS: 8,
  TV: 9,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function mix(pairs: Array<[value: number, weight: number]>): number {
  const weightTotal = pairs.reduce((total, [, weight]) => total + weight, 0);
  if (weightTotal <= 0) {
    return 0;
  }
  const weightedTotal = pairs.reduce((total, [value, weight]) => total + value * weight, 0);
  return weightedTotal / weightTotal;
}



export function computeEndingAxisScores(params: {
  stats: Stats;
  hiddenStats: HiddenStats;
}): Record<EndingAxis, number> {
  const { stats, hiddenStats } = params;

  const scores: Record<EndingAxis, number> = {
    SS: mix([
      [hiddenStats.welfare_state, 0.24],
      [hiddenStats.public_services, 0.22],
      [hiddenStats.universal_healthcare, 0.22],
      [hiddenStats.poverty_relief, 0.16],
      [stats.sentiment, 0.08],
      [stats.sustainability, 0.08],
    ]),
    GS: mix([
      [hiddenStats.environmentalism, 0.34],
      [hiddenStats.conservation, 0.3],
      [hiddenStats.sustainability, 0.24],
      [stats.sustainability, 0.12],
    ]),
    GD: mix([
      [hiddenStats.world_peace, 0.32],
      [hiddenStats.internationalism, 0.32],
      [hiddenStats.global_justice, 0.26],
      [stats.authority, 0.1],
    ]),
    HN: mix([
      [hiddenStats.containing_immigration, 0.34],
      [hiddenStats.nationalism, 0.3],
      [hiddenStats.white_supremacy, 0.24],
      [stats.authority, 0.12],
    ]),
    MG: mix([
      [hiddenStats.economic_growth, 0.34],
      [hiddenStats.free_market, 0.28],
      [hiddenStats.entrepreneurship, 0.24],
      [stats.capital, 0.14],
    ]),
    IE: mix([
      [hiddenStats.civil_rights, 0.24],
      [hiddenStats.social_justice, 0.24],
      [hiddenStats.anti_racism, 0.18],
      [hiddenStats.feminism, 0.12],
      [hiddenStats.lgbt_rights, 0.12],
      [stats.sentiment, 0.1],
    ]),
    LP: mix([
      [hiddenStats.workers_rights, 0.34],
      [hiddenStats.job_creation, 0.26],
      [hiddenStats.unionization, 0.26],
      [stats.sentiment, 0.14],
    ]),
    FR: mix([
      [hiddenStats.tax_cuts, 0.28],
      [hiddenStats.small_government, 0.24],
      [hiddenStats.austerity, 0.24],
      [stats.capital, 0.14],
      [100 - hiddenStats.welfare_state, 0.1],
    ]),
    NS: mix([
      [hiddenStats.security, 0.32],
      [hiddenStats.military_strength, 0.28],
      [hiddenStats.fighting_crime_terrorism, 0.24],
      [stats.authority, 0.08],
      [stats.sustainability, 0.08],
    ]),
    TV: mix([
      [hiddenStats.tradition, 0.38],
      [hiddenStats.christianity, 0.32],
      [hiddenStats.rural_life, 0.2],
      [stats.sentiment, 0.1],
    ]),
  };

  for (const axis of ENDING_AXES) {
    scores[axis] = clamp(scores[axis], 0, 200);
  }

  return scores;
}

function getTopTwoAxes(scores: Record<EndingAxis, number>): [EndingAxis, EndingAxis] {
  const sorted = [...ENDING_AXES].sort((a, b) => {
    const byScore = scores[b] - scores[a];
    if (byScore !== 0) {
      return byScore;
    }
    return AXIS_SORT_ORDER[a] - AXIS_SORT_ORDER[b];
  });
  return [sorted[0], sorted[1]];
}



function generateModularLegacy(hiddenStats: HiddenStats): string {
  const sorted = [...HIDDEN_STAT_KEYS]
    .sort((a, b) => (hiddenStats[b] ?? 0) - (hiddenStats[a] ?? 0))
    .slice(0, 3);

  if (sorted.length < 3) {
    return 'The republic moves forward into an uncertain future.';
  }

  const p1 = LEGACY_PARAGRAPHS[sorted[0]];
  const p2 = LEGACY_PARAGRAPHS[sorted[1]];
  const p3 = LEGACY_PARAGRAPHS[sorted[2]];

  const first = p1.charAt(0).toUpperCase() + p1.slice(1);

  return `${first} Meanwhile, ${p2} Ultimately, ${p3}`;
}

function calculateLegacyTitle(hiddenStats: HiddenStats): string {
  const topStats = [...HIDDEN_STAT_KEYS]
    .sort((a, b) => (hiddenStats[b] ?? 0) - (hiddenStats[a] ?? 0))
    .slice(0, 3);

  const pillars = topStats.map((stat) => HIDDEN_STAT_TO_PILLAR[stat]);
  const counts: Record<string, number> = {};
  for (const p of pillars) {
    counts[p] = (counts[p] ?? 0) + 1;
  }

  const distinctPillars = Object.keys(counts);

  // Case 1: All 3 are from the same pillar
  if (distinctPillars.length === 1) {
    const pillar = distinctPillars[0] as PolicyPillarKey;
    return SINGLE_PILLAR_TITLES[pillar] ?? 'The Singular Republic';
  }

  // Case 2: 2 in one pillar, 1 in another
  if (distinctPillars.length === 2) {
    const majority = distinctPillars.find((p) => counts[p] === 2) as PolicyPillarKey;
    const minority = distinctPillars.find((p) => counts[p] === 1) as PolicyPillarKey;
    return DOUBLE_PILLAR_TITLES[`${majority}_${minority}`] ?? 'The Dual Legacy';
  }

  // Case 3: All 3 different pillars
  const sorted = [...distinctPillars].sort();
  const key = sorted.join('_');
  return TRIPLE_PILLAR_TITLES[key] ?? 'The Composite Republic';
}

export function resolveEnding(params: {
  stats: Stats;
  hiddenStats: HiddenStats;
}): EndingResolution {
  const scores = computeEndingAxisScores(params);
  const [primary] = getTopTwoAxes(scores);
  const title = calculateLegacyTitle(params.hiddenStats);
  const modularLegacy = generateModularLegacy(params.hiddenStats);
  
  return {
    primary,
    secondary: primary, // Secondary no longer drives the summary
    definition: {
      title,
      summary: '', // Legacy summaries removed
    },
    scores,
    modularLegacy,
  };
}

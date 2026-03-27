export const STAT_KEYS = ['authority', 'capital', 'sentiment', 'sustainability'] as const;
export const ACTIVE_STAT_KEYS = ['authority', 'capital', 'sentiment', 'sustainability'] as const;

export const REGION_KEYS = [
  'pacific_northwest',
  'california',
  'mountain_west',
  'southwest',
  'great_plains',
  'texas',
  'midwest_great_lakes',
  'appalachia',
  'mid_atlantic',
  'northeast',
  'southeast',
  'deep_south_gulf_coast',
  'alaska',
  'hawaii',
] as const;

export const POLICY_PILLAR_KEYS = [
  'social_safety_net',
  'green_stewardship',
  'global_diplomacy',
  'hardline_nationalism',
  'market_growth',
  'identity_equity',
  'labor_power',
  'fiscal_restraint',
  'national_security',
  'traditional_values',
] as const;

export const HIDDEN_STAT_KEYS = [
  'welfare_state',
  'public_services',
  'universal_healthcare',
  'poverty_relief',
  'environmentalism',
  'conservation',
  'sustainability',
  'world_peace',
  'internationalism',
  'global_justice',
  'containing_immigration',
  'nationalism',
  'white_supremacy',
  'economic_growth',
  'free_market',
  'entrepreneurship',
  'civil_rights',
  'social_justice',
  'anti_racism',
  'feminism',
  'lgbt_rights',
  'workers_rights',
  'job_creation',
  'unionization',
  'tax_cuts',
  'small_government',
  'austerity',
  'security',
  'military_strength',
  'fighting_crime_terrorism',
  'tradition',
  'christianity',
  'rural_life',
] as const;

export const VULNERABILITY_BUCKET_KEYS = [
  'public_health_emergency',
  'ecological_collapse',
  'global_conflict',
  'border_escalation',
  'market_crash',
  'general_labor_strike',
  'civil_rights_uprising',
  'culture_war_paralysis',
  'sovereign_debt_default',
  'domestic_terror_wave',
  'rural_separatist_movement',
] as const;

export type VulnerabilityBucketKey = typeof VULNERABILITY_BUCKET_KEYS[number];


export const ADVISOR_IDS = [
  'realpolitiker',
  'revolutionary',
  'vulture',
  'iron_vance',
  'spin_doctor',
  'data_broker',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type ActiveStatKey = (typeof ACTIVE_STAT_KEYS)[number];
export type RegionKey = (typeof REGION_KEYS)[number];
export type PolicyPillarKey = (typeof POLICY_PILLAR_KEYS)[number];
export type GovernorProPillars = readonly [PolicyPillarKey, PolicyPillarKey];
export type HiddenStatKey = (typeof HIDDEN_STAT_KEYS)[number];
export type GovernorProHiddenStats = readonly [HiddenStatKey, HiddenStatKey, HiddenStatKey];
export type CardTagKey = PolicyPillarKey;
export type AdvisorId = (typeof ADVISOR_IDS)[number];

export const CARD_TYPES = [
  'governor_request',
  'federal_initiative',
  'fallout',
  'cross',
  'maintenance',
  'synth',
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export type Stats = Record<StatKey, number>;
export type StatBuffers = Record<StatKey, number>;
export type Effects = Partial<Record<StatKey, number>>;
export type RegionalEffects = Partial<Record<RegionKey, number>>;
export type HiddenStats = Record<HiddenStatKey, number>;
export type HiddenStatEffects = Partial<Record<HiddenStatKey, number>>;

export const STAT_DISPLAY_LABELS: Record<StatKey, string> = {
  authority: 'Authority (Federal Grip vs Regional Defiance)',
  capital: 'Capital (State Wealth and Economic Health)',
  sentiment: 'Sentiment (Order vs Chaos)',
  sustainability: 'Sustainability (Land and Resource Viability)',
};

export const STAT_EMOJIS: Record<StatKey, string> = {
  authority: '⚖️',
  capital: '💰',
  sentiment: '🗳️',
  sustainability: '🌱',
};

const LEGACY_STAT_KEY_MAP: Record<string, StatKey> = {
  union: 'authority',
  treasury: 'capital',
  approval: 'sentiment',
  stability: 'sustainability',
};

export function normalizeStatKey(input: string): StatKey | null {
  if ((STAT_KEYS as readonly string[]).includes(input)) {
    return input as StatKey;
  }
  return LEGACY_STAT_KEY_MAP[input.trim().toLowerCase()] ?? null;
}

export type RegionLoyaltyByRegion = Record<RegionKey, number>;
export type RegionLoyaltyState = 'revolt' | 'angry' | 'neutral' | 'supportive' | 'loyalist';

const REGION_ALIAS_LOOKUP: Record<string, RegionKey> = {
  pacificnorthwest: 'pacific_northwest',
  cascadia: 'pacific_northwest',
  governorthorne: 'pacific_northwest',
  govthorne: 'pacific_northwest',
  california: 'california',
  governorrosalesking: 'california',
  govrosalesking: 'california',
  southwest: 'southwest',
  mesa: 'southwest',
  governorvance: 'southwest',
  govvance: 'southwest',
  mountainwest: 'mountain_west',
  frontier: 'mountain_west',
  governorcassidy: 'mountain_west',
  govcassidy: 'mountain_west',
  greatplains: 'great_plains',
  heartland: 'great_plains',
  governorgantry: 'great_plains',
  govgantry: 'great_plains',
  texas: 'texas',
  governorwalker: 'texas',
  govwalker: 'texas',
  midwestgreatlakes: 'midwest_great_lakes',
  superior: 'midwest_great_lakes',
  governorkowalski: 'midwest_great_lakes',
  govkowalski: 'midwest_great_lakes',
  appalachia: 'appalachia',
  governorcalloway: 'appalachia',
  govcalloway: 'appalachia',
  midatlantic: 'mid_atlantic',
  commonwealth: 'mid_atlantic',
  governorsterling: 'mid_atlantic',
  govsterling: 'mid_atlantic',
  northeast: 'northeast',
  union: 'northeast',
  governorvane: 'northeast',
  govvane: 'northeast',
  southeast: 'southeast',
  piedmont: 'southeast',
  governorashcroft: 'southeast',
  govashcroft: 'southeast',
  deepsouthgulfcoast: 'deep_south_gulf_coast',
  dixie: 'deep_south_gulf_coast',
  governorleblanc: 'deep_south_gulf_coast',
  govleblanc: 'deep_south_gulf_coast',
  alaska: 'alaska',
  governoromalley: 'alaska',
  govomalley: 'alaska',
  hawaii: 'hawaii',
  governorpalakiko: 'hawaii',
  govpalakiko: 'hawaii',
};

export interface PolicyPillarDefinition {
  key: PolicyPillarKey;
  label: string;
  shortLabel: string;
  description: string;
}

export interface AdvisorSelectionBias {
  pillarMultipliers?: Partial<Record<PolicyPillarKey, number>>;
}

export function isAdvisorId(value: string): value is AdvisorId {
  return (ADVISOR_IDS as readonly string[]).includes(value);
}

export function getRegionLoyaltyState(value: number): RegionLoyaltyState {
  if (value <= 20) {
    return 'revolt';
  }
  if (value <= 40) {
    return 'angry';
  }
  if (value <= 60) {
    return 'neutral';
  }
  if (value <= 80) {
    return 'supportive';
  }
  return 'loyalist';
}

export function normalizeRegionKey(input: string): RegionKey | null {
  if ((REGION_KEYS as readonly string[]).includes(input)) {
    return input as RegionKey;
  }

  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const alias = REGION_ALIAS_LOOKUP[normalized];
  return alias ?? null;
}

export function normalizePolicyPillarKey(input: string): PolicyPillarKey | null {
  return (POLICY_PILLAR_KEYS as readonly string[]).includes(input) ? (input as PolicyPillarKey) : null;
}

export function normalizeHiddenStatKey(input: string): HiddenStatKey | null {
  return (HIDDEN_STAT_KEYS as readonly string[]).includes(input) ? (input as HiddenStatKey) : null;
}

export function normalizeCardTagKey(input: string): PolicyPillarKey | null {
  return normalizePolicyPillarKey(input);
}

export interface CardChoice {
  label: string;
  effects?: Effects;
  treasuryDelta?: number;
  regionalEffects?: RegionalEffects;
  hiddenEffects?: HiddenStatEffects;
  setFlags?: string[];
}

export interface Card {
  id: string;
  kind?: 'policy';
  type?: CardType;
  governor?: RegionKey;
  targetRegions?: RegionKey[];
  pillarTags?: CardTagKey[];
  tier?: 1 | 2 | 3;
  category?: string;
  path?: string;
  prompt: string;
  left: CardChoice;
  right: CardChoice;
}

export interface ReactionCard extends Card {
  requiredFlags?: string[];
  requiredAdvisorId?: AdvisorId;
}

export interface MandateDefinition {
  key: PolicyPillarKey;
  name: string;
  description: string;
}

export const MANDATES: Record<PolicyPillarKey, MandateDefinition> = {
  social_safety_net: { key: 'social_safety_net', name: 'The Welfare Mandate', description: 'All negative Sentiment drops from cards are reduced by 50%.' },
  green_stewardship: { key: 'green_stewardship', name: 'The Green Mandate', description: 'All negative Sustainability drops from cards are reduced by 50%.' },
  global_diplomacy: { key: 'global_diplomacy', name: 'The Peace Mandate', description: '+5 Capital and +5 Sentiment each turn.' },
  hardline_nationalism: { key: 'hardline_nationalism', name: 'The Nationalist Mandate', description: '+5 Authority each turn and each region receives a static +10 to regional loyalty.' },
  market_growth: { key: 'market_growth', name: 'The Prosperity Mandate', description: 'All positive Capital gains are doubled.' },
  identity_equity: { key: 'identity_equity', name: 'The Equity Mandate', description: 'Sentiment gains are doubled.' },
  labor_power: { key: 'labor_power', name: 'The Labor Mandate', description: 'Capital costs are reduced by 25% and sentiment gains increased by 25%.' },
  fiscal_restraint: { key: 'fiscal_restraint', name: 'The Austerity Mandate', description: 'Capital costs are reduced by 50%.' },
  national_security: { key: 'national_security', name: 'The Security Mandate', description: 'All crisis card effects reduced by 50%.' },
  traditional_values: { key: 'traditional_values', name: 'The Heritage Mandate', description: 'A static +25 to regional loyalty.' },
};


export interface RawCard extends Omit<Card, 'left' | 'right'> {
  left?: CardChoice;
  right?: CardChoice;
  yes?: CardChoice;
  no?: CardChoice;
}

export type Direction = 'left' | 'right';

export type GameOverReason =
  | 'authority'
  | 'capital'
  | 'sentiment'
  | 'sustainability'
  | 'no_confidence'
  | 'impeachment'
  | 'completed'
  | null;

export interface GameState {
  advisorId: AdvisorId | null;
  stats: Stats;
  statBuffers: StatBuffers;
  hiddenStats: HiddenStats;
  corruption: number;
  regionLoyalty: RegionLoyaltyByRegion;
  turn: number;
  deck: string[];
  currentCardId: string | null;
  headline: string | null;
  endingSummary: string | null;
  gameOver: boolean;
  gameOverReason: GameOverReason;
  malikCooldown: number;
  malikRewriteActive: boolean;
  pacifiedRegions: RegionKey[];
  krossLastUsedElectionTerm: number | null;
  santanaLastUsedElectionTerm: number | null;
  santanaLastUsedTurn: number | null;
  martialLawActive: boolean;
  unlockedDirection: Direction | null;
  activeUnlock: 'bribe' | 'force' | null;
  flags: string[];
  activeMandate: PolicyPillarKey | null;
  pillarTallies: Record<PolicyPillarKey, number>;
  endlessMode?: boolean;
  showFinaleChoice?: boolean;
}

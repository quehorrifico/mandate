import type { GovernorProHiddenStats, GovernorProPillars, RegionKey } from '../types';

export interface GovernorProfile {
  region: RegionKey;
  emoji: string;
  futureRegionName: string;
  governorName: string;
  personality: string;
  proPillars: GovernorProPillars;
  proHiddenStats: GovernorProHiddenStats;
}

export const GOVERNORS: Record<RegionKey, GovernorProfile> = {
  pacific_northwest: {
    region: 'pacific_northwest',
    emoji: '🌲',
    futureRegionName: 'Cascadia',
    governorName: 'Governor Thorne',
    personality: 'Sells sustainability while fighting over every drop of water.',
    proPillars: ['green_stewardship', 'global_diplomacy'],
    proHiddenStats: ['environmentalism', 'sustainability', 'workers_rights'],
  },
  california: {
    region: 'california',
    emoji: '🌴',
    futureRegionName: 'California',
    governorName: 'Governor Rosales-King',
    personality: 'Runs policy meetings like a startup product launch.',
    proPillars: ['market_growth', 'identity_equity'],
    proHiddenStats: ['entrepreneurship', 'anti_racism', 'civil_rights'],
  },
  southwest: {
    region: 'southwest',
    emoji: '🌵',
    futureRegionName: 'Mesa',
    governorName: 'Governor Vance',
    personality: 'Treats water planning like military strategy.',
    proPillars: ['national_security', 'hardline_nationalism'],
    proHiddenStats: ['fighting_crime_terrorism', 'military_strength', 'containing_immigration'],
  },
  mountain_west: {
    region: 'mountain_west',
    emoji: '🏔️',
    futureRegionName: 'Frontier',
    governorName: 'Governor Cassidy',
    personality: 'Libertarian billionaire who distrusts federal rules on principle.',
    proPillars: ['market_growth', 'fiscal_restraint'],
    proHiddenStats: ['free_market', 'small_government', 'tax_cuts'],
  },
  great_plains: {
    region: 'great_plains',
    emoji: '🌾',
    futureRegionName: 'Heartland',
    governorName: 'Governor Gantry',
    personality: 'Grandmotherly negotiator with cartel-level grain bargaining power.',
    proPillars: ['traditional_values', 'fiscal_restraint'],
    proHiddenStats: ['tradition', 'rural_life', 'austerity'],
  },
  texas: {
    region: 'texas',
    emoji: '🤠',
    futureRegionName: 'Texas',
    governorName: 'Governor Walker',
    personality: 'Believes every national problem can be solved with bigger energy deals.',
    proPillars: ['market_growth', 'fiscal_restraint'],
    proHiddenStats: ['economic_growth', 'free_market', 'tax_cuts'],
  },
  midwest_great_lakes: {
    region: 'midwest_great_lakes',
    emoji: '🚰',
    futureRegionName: 'Superior',
    governorName: 'Governor Kowalski',
    personality: 'Union hardliner who calls every automation plan a scam.',
    proPillars: ['labor_power', 'market_growth'],
    proHiddenStats: ['unionization', 'workers_rights', 'economic_growth'],
  },
  appalachia: {
    region: 'appalachia',
    emoji: '🎻',
    futureRegionName: 'Appalachia',
    governorName: 'Governor Calloway',
    personality: 'Folksy economist with polished speeches and sharp elbows.',
    proPillars: ['labor_power', 'traditional_values'],
    proHiddenStats: ['tradition', 'unionization', 'rural_life'],
  },
  mid_atlantic: {
    region: 'mid_atlantic',
    emoji: '🏛️',
    futureRegionName: 'Commonwealth',
    governorName: 'Governor Sterling',
    personality: 'Bureaucratic chess master who never wastes a procedural loophole.',
    proPillars: ['national_security', 'fiscal_restraint'],
    proHiddenStats: ['security', 'fighting_crime_terrorism', 'small_government'],
  },
  northeast: {
    region: 'northeast',
    emoji: '💼',
    futureRegionName: 'Union',
    governorName: 'Governor Vane',
    personality: 'Finance-first dealmaker who sees every region as a balance sheet.',
    proPillars: ['fiscal_restraint', 'global_diplomacy'],
    proHiddenStats: ['austerity', 'civil_rights', 'environmentalism'],
  },
  southeast: {
    region: 'southeast',
    emoji: '🎬',
    futureRegionName: 'Piedmont',
    governorName: 'Governor Ashcroft',
    personality: 'Smiling growth guru who sells every policy as "innovation".',
    proPillars: ['market_growth', 'global_diplomacy'],
    proHiddenStats: ['entrepreneurship', 'free_market', 'internationalism'],
  },
  deep_south_gulf_coast: {
    region: 'deep_south_gulf_coast',
    emoji: '⚓',
    futureRegionName: 'Dixie',
    governorName: 'Governor LeBlanc',
    personality: 'Chaotic port populist with pirate energy.',
    proPillars: ['market_growth', 'traditional_values'],
    proHiddenStats: ['economic_growth', 'tradition', 'christianity'],
  },
  alaska: {
    region: 'alaska',
    emoji: '🐻',
    futureRegionName: 'Alaska',
    governorName: "Governor O'Malley",
    personality: 'Remote survivalist who treats federal politics as a side show.',
    proPillars: ['market_growth', 'national_security'],
    proHiddenStats: ['economic_growth', 'military_strength', 'security'],
  },
  hawaii: {
    region: 'hawaii',
    emoji: '🌺',
    futureRegionName: 'Hawaii',
    governorName: 'Governor Palakiko',
    personality: 'Calm strategist focused on long-term island resilience.',
    proPillars: ['green_stewardship', 'identity_equity'],
    proHiddenStats: ['sustainability', 'anti_racism', 'internationalism'],
  },
};

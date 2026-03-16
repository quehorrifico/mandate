import { type PolicyPillarKey } from '../types';

/**
 * 220 Dynamic Titles for the Federal Republic of America
 * * Lookup structure:
 * 1. SINGLE_PILLAR: When all top 3 hidden stats belong to one pillar. (10 titles)
 * 2. DOUBLE_PILLAR: When 2 stats belong to one pillar (Majority) and 1 to another (Minority). (90 titles)
 * 3. TRIPLE_PILLAR: When all 3 stats belong to different pillars. (120 combinations, sorted alphabetically)
 */

export const SINGLE_PILLAR_TITLES: Record<PolicyPillarKey, string> = {
  social_safety_net: 'The Era of the Compassionate State',
  green_stewardship: 'The Verdant Epoch',
  global_diplomacy: 'The Cosmopolitan Consensus',
  hardline_nationalism: 'The Nativist Sanctuary',
  market_growth: 'The Gilded Renaissance',
  identity_equity: 'The Egalitarian Dawn',
  labor_power: 'The Workers\' Commonwealth',
  fiscal_restraint: 'The Austere Years',
  national_security: 'The Garrison State',
  traditional_values: 'The Ancestral Revival',
};

// Key: "majority_minority"
export const DOUBLE_PILLAR_TITLES: Record<string, string> = {
  // Social Safety-net Majority
  social_safety_net_green_stewardship: 'The Eco-Welfare State',
  social_safety_net_global_diplomacy: 'The Global Aid Initiative',
  social_safety_net_hardline_nationalism: 'National Paternalism',
  social_safety_net_market_growth: 'Social Capitalism',
  social_safety_net_identity_equity: 'The Inclusive Society',
  social_safety_net_labor_power: 'The Social Democracy',
  social_safety_net_fiscal_restraint: 'The Means-Tested State',
  social_safety_net_national_security: 'The Secure Safety Net',
  social_safety_net_traditional_values: 'Charitable Orthodoxy',

  // Green Stewardship Majority
  green_stewardship_social_safety_net: 'The Green New Deal',
  green_stewardship_global_diplomacy: 'The Global Climate Pact',
  green_stewardship_hardline_nationalism: 'Eco-Nationalism',
  green_stewardship_market_growth: 'Green Capitalism',
  green_stewardship_identity_equity: 'Environmental Justice',
  green_stewardship_labor_power: 'The Green Collar Era',
  green_stewardship_fiscal_restraint: 'Sustainable Austerity',
  green_stewardship_national_security: 'Eco-Fortress America',
  green_stewardship_traditional_values: 'Agrarian Stewardship',

  // Global Diplomacy Majority
  global_diplomacy_social_safety_net: 'Humanitarian Globalism',
  global_diplomacy_green_stewardship: 'The Biosphere Alliance',
  global_diplomacy_hardline_nationalism: 'The Sovereign Coalition',
  global_diplomacy_market_growth: 'The Free Trade Empire',
  global_diplomacy_identity_equity: 'The Universal Human Rights Era',
  global_diplomacy_labor_power: 'The International Workers\' Pact',
  global_diplomacy_fiscal_restraint: 'The Lean Diplomatic Corps',
  global_diplomacy_national_security: 'The Hegemonic Peace',
  global_diplomacy_traditional_values: 'The Traditional Alliance',

  // Hardline Nationalism Majority
  hardline_nationalism_social_safety_net: 'The Chauvinist Welfare State',
  hardline_nationalism_green_stewardship: 'Blood and Soil Conservation',
  hardline_nationalism_global_diplomacy: 'The America First Doctrine',
  hardline_nationalism_market_growth: 'National Capitalism',
  hardline_nationalism_identity_equity: 'The Assimilationist Era',
  hardline_nationalism_labor_power: 'National Syndicalism',
  hardline_nationalism_fiscal_restraint: 'The Lean Republic',
  hardline_nationalism_national_security: 'The Homeland Fortress',
  hardline_nationalism_traditional_values: 'The Nativist Heritage',

  // Market Growth Majority
  market_growth_social_safety_net: 'Compassionate Capitalism',
  market_growth_green_stewardship: 'The Sustainable Market',
  market_growth_global_diplomacy: 'Globalized Commerce',
  market_growth_hardline_nationalism: 'Mercantilist Revival',
  market_growth_identity_equity: 'The Inclusive Economy',
  market_growth_labor_power: 'The Corporate Compromise',
  market_growth_fiscal_restraint: 'The Laissez-Faire Ascendancy',
  market_growth_national_security: 'The Military-Industrial Boom',
  market_growth_traditional_values: 'Traditional Enterprise',

  // Identity Equity Majority
  identity_equity_social_safety_net: 'The Equitable Safety Net',
  identity_equity_green_stewardship: 'The Intersectionally Green Era',
  identity_equity_global_diplomacy: 'The Global Justice Initiative',
  identity_equity_hardline_nationalism: 'Civic Nationalism',
  identity_equity_market_growth: 'Rainbow Capitalism',
  identity_equity_labor_power: 'The Equal Opportunity Labor Era',
  identity_equity_fiscal_restraint: 'The Meritocratic State',
  identity_equity_national_security: 'The Inclusive Military',
  identity_equity_traditional_values: 'Reformed Orthodoxy',

  // Labor Power Majority
  labor_power_social_safety_net: 'Welfare Trade Unionism',
  labor_power_green_stewardship: 'The Eco-Syndicalist Era',
  labor_power_global_diplomacy: 'The Proletarian International',
  labor_power_hardline_nationalism: 'The Patriotic Working Class',
  labor_power_market_growth: 'The High-Wage Economy',
  labor_power_identity_equity: 'The Intersectional Guilds',
  labor_power_fiscal_restraint: 'The Austere Communes',
  labor_power_national_security: 'The Militarized Workforce',
  labor_power_traditional_values: 'The Guild Socialist Era',

  // Fiscal Restraint Majority
  fiscal_restraint_social_safety_net: 'The Pragmatic Welfare State',
  fiscal_restraint_green_stewardship: 'The Lean Green State',
  fiscal_restraint_global_diplomacy: 'The Isolationist Ledger',
  fiscal_restraint_hardline_nationalism: 'The Frugal Nation',
  fiscal_restraint_market_growth: 'The Neoliberal Consensus',
  fiscal_restraint_identity_equity: 'Equal Austerity',
  fiscal_restraint_labor_power: 'The Balanced Labor Ledger',
  fiscal_restraint_national_security: 'The Cost-Effective Shield',
  fiscal_restraint_traditional_values: 'The Puritanical Budget',

  // National Security Majority
  national_security_social_safety_net: 'The Garrison Welfare State',
  national_security_green_stewardship: 'The Strategic Reserve',
  national_security_global_diplomacy: 'The Armed Peacemakers',
  national_security_hardline_nationalism: 'The Ultra-Secure Border',
  national_security_market_growth: 'The Corporate Security State',
  national_security_identity_equity: 'The Justified Shield',
  national_security_labor_power: 'The Industrial Defense Complex',
  national_security_fiscal_restraint: 'The Minuteman Republic',
  national_security_traditional_values: 'The Crusader State',

  // Traditional Values Majority
  traditional_values_social_safety_net: 'The Paternalist Society',
  traditional_values_green_stewardship: 'The Pastoral Renaissance',
  traditional_values_global_diplomacy: 'The Apostolic Mission',
  traditional_values_hardline_nationalism: 'The Bloodline Mandate',
  traditional_values_market_growth: 'The Protestant Work Ethic',
  traditional_values_identity_equity: 'The Tolerant Hearth',
  traditional_values_labor_power: 'The Guild System Revival',
  traditional_values_fiscal_restraint: 'The Frugal Ancestors',
  traditional_values_national_security: 'The Holy Bulwark',
};

// Key: "p1_p2_p3" (strictly sorted alphabetically)
export const TRIPLE_PILLAR_TITLES: Record<string, string> = {
  // Combinations including Fiscal Restraint (FR)
  fiscal_restraint_global_diplomacy_green_stewardship: 'The Lean Climate Treaty',
  fiscal_restraint_global_diplomacy_hardline_nationalism: 'The Isolationist Ledger',
  fiscal_restraint_global_diplomacy_identity_equity: 'The Lean Humanitarians',
  fiscal_restraint_global_diplomacy_labor_power: 'The Austere International',
  fiscal_restraint_global_diplomacy_market_growth: 'The Free Trade Ascendancy',
  fiscal_restraint_global_diplomacy_national_security: 'The Strategic Restraint Era',
  fiscal_restraint_global_diplomacy_social_safety_net: 'The Pragmatic Aid Order',
  fiscal_restraint_global_diplomacy_traditional_values: 'The Minimalist Diplomats',
  fiscal_restraint_green_stewardship_hardline_nationalism: 'Fortress Conservation',
  fiscal_restraint_green_stewardship_identity_equity: 'Equitable Conservation',
  fiscal_restraint_green_stewardship_labor_power: 'Austere Eco-Syndicalism',
  fiscal_restraint_green_stewardship_market_growth: 'Free Market Environmentalism',
  fiscal_restraint_green_stewardship_national_security: 'Lean Resource Defense',
  fiscal_restraint_green_stewardship_social_safety_net: 'The Balanced Eco-State',
  fiscal_restraint_green_stewardship_traditional_values: 'Ascetic Environmentalism',
  fiscal_restraint_hardline_nationalism_identity_equity: 'Egalitarian Nationalism',
  fiscal_restraint_hardline_nationalism_labor_power: 'Lean National Syndicalism',
  fiscal_restraint_hardline_nationalism_market_growth: 'The Nativist Free Market',
  fiscal_restraint_hardline_nationalism_national_security: 'The Spartan Sanctuary',
  fiscal_restraint_hardline_nationalism_social_safety_net: 'Nativist Austerity',
  fiscal_restraint_hardline_nationalism_traditional_values: 'Ancestral Austerity',
  fiscal_restraint_identity_equity_labor_power: 'Lean Egalitarianism',
  fiscal_restraint_identity_equity_market_growth: 'Meritocratic Libertarianism',
  fiscal_restraint_identity_equity_national_security: 'The Equitable Garrison',
  fiscal_restraint_identity_equity_social_safety_net: 'Means-Tested Equity',
  fiscal_restraint_identity_equity_traditional_values: 'Ascetic Equality',
  fiscal_restraint_labor_power_market_growth: 'The Balanced Growth Era',
  fiscal_restraint_labor_power_national_security: 'The Austere Command Economy',
  fiscal_restraint_labor_power_social_safety_net: 'The Austere Labor Commonwealth',
  fiscal_restraint_labor_power_traditional_values: 'The Frugal Yeomanry',
  fiscal_restraint_market_growth_national_security: 'The Minarchist Defense State',
  fiscal_restraint_market_growth_social_safety_net: 'The Centrist Compromise',
  fiscal_restraint_market_growth_traditional_values: 'The Conservative Ascendancy',
  fiscal_restraint_national_security_social_safety_net: 'The Minimalist Safety Net',
  fiscal_restraint_national_security_traditional_values: 'The Spartan Theocracy',
  fiscal_restraint_social_safety_net_traditional_values: 'The Frugal Charity State',

  // Combinations including Global Diplomacy (GD) - excluding FR
  global_diplomacy_green_stewardship_hardline_nationalism: 'The Sovereign Earth Policy',
  global_diplomacy_green_stewardship_identity_equity: 'The Planetary Justice Era',
  global_diplomacy_green_stewardship_labor_power: 'The International Green Syndicates',
  global_diplomacy_green_stewardship_market_growth: 'The Global Green Economy',
  global_diplomacy_green_stewardship_national_security: 'The Global Climate Security Act',
  global_diplomacy_green_stewardship_social_safety_net: 'The Global Eco-Welfare Consensus',
  global_diplomacy_green_stewardship_traditional_values: 'Universal Stewardship',
  global_diplomacy_hardline_nationalism_identity_equity: 'The Imperial Civilizers',
  global_diplomacy_hardline_nationalism_labor_power: 'National Internationalism',
  global_diplomacy_hardline_nationalism_market_growth: 'The Hegemonic Trade Empire',
  global_diplomacy_hardline_nationalism_national_security: 'The Global Policeman Era',
  global_diplomacy_hardline_nationalism_social_safety_net: 'The Sovereign Aid Paradox',
  global_diplomacy_hardline_nationalism_traditional_values: 'The Sovereign Network',
  global_diplomacy_identity_equity_labor_power: 'Transnational Liberation',
  global_diplomacy_identity_equity_market_growth: 'The Neoliberal Human Rights Era',
  global_diplomacy_identity_equity_national_security: 'The Interventionist Justice Era',
  global_diplomacy_identity_equity_social_safety_net: 'The International Justice Coalition',
  global_diplomacy_identity_equity_traditional_values: 'The Global Ecumenical Movement',
  global_diplomacy_labor_power_market_growth: 'The Global Supply Chain Union',
  global_diplomacy_labor_power_national_security: 'The Global Arsenal of Democracy',
  global_diplomacy_labor_power_social_safety_net: 'The Global Workers\' Relief',
  global_diplomacy_labor_power_traditional_values: 'The International Guilds',
  global_diplomacy_market_growth_national_security: 'The Armed Globalization Era',
  global_diplomacy_market_growth_social_safety_net: 'The Globalized Social Democracy',
  global_diplomacy_market_growth_traditional_values: 'The Silk Road Revival',
  global_diplomacy_national_security_social_safety_net: 'The Humanitarian Interventionists',
  global_diplomacy_national_security_traditional_values: 'The Holy Alliance',
  global_diplomacy_social_safety_net_traditional_values: 'The Global Missionary State',

  // Combinations including Green Stewardship (GS) - excluding FR, GD
  green_stewardship_hardline_nationalism_identity_equity: 'The Deep Ecology Movement',
  green_stewardship_hardline_nationalism_labor_power: 'National Green Labor',
  green_stewardship_hardline_nationalism_market_growth: 'Eco-Mercantilism',
  green_stewardship_hardline_nationalism_national_security: 'The Eco-Fascist Anomaly',
  green_stewardship_hardline_nationalism_social_safety_net: 'Green Paternalism',
  green_stewardship_hardline_nationalism_traditional_values: 'Blood and Soil Agrarianism',
  green_stewardship_identity_equity_labor_power: 'Eco-Socialism',
  green_stewardship_identity_equity_market_growth: 'Conscious Capitalism',
  green_stewardship_identity_equity_national_security: 'The Green Vanguard',
  green_stewardship_identity_equity_social_safety_net: 'Intersectional Eco-Socialism',
  green_stewardship_identity_equity_traditional_values: 'The Harmonious Earth Initiative',
  green_stewardship_labor_power_market_growth: 'The Sustainable Industrial Era',
  green_stewardship_labor_power_national_security: 'The Green Command Economy',
  green_stewardship_labor_power_social_safety_net: 'The Green Labor Alliance',
  green_stewardship_labor_power_traditional_values: 'Agrarian Laborism',
  green_stewardship_market_growth_national_security: 'The Resource Security State',
  green_stewardship_market_growth_social_safety_net: 'The Sustainable Social Market',
  green_stewardship_market_growth_traditional_values: 'The Pastoral Market Era',
  green_stewardship_national_security_social_safety_net: 'The Secure Biosphere Initiative',
  green_stewardship_national_security_traditional_values: 'The Sacred Land Defense',
  green_stewardship_social_safety_net_traditional_values: 'Pastoral Care Administration',

  // Combinations including Hardline Nationalism (HN) - excluding FR, GD, GS
  hardline_nationalism_identity_equity_labor_power: 'The Assimilated Workforce',
  hardline_nationalism_identity_equity_market_growth: 'The Homogeneous Consumer State',
  hardline_nationalism_identity_equity_national_security: 'The Civic Fortress',
  hardline_nationalism_identity_equity_social_safety_net: 'The Assimilated Welfare State',
  hardline_nationalism_identity_equity_traditional_values: 'The Culturally United Republic',
  hardline_nationalism_labor_power_market_growth: 'National Corporatism',
  hardline_nationalism_labor_power_national_security: 'The Militarized Working Class',
  hardline_nationalism_labor_power_social_safety_net: 'Patriotic Syndicalism',
  hardline_nationalism_labor_power_traditional_values: 'The Patriotic Guilds',
  hardline_nationalism_market_growth_national_security: 'The Military-Industrial Autarky',
  hardline_nationalism_market_growth_social_safety_net: 'National Social Capitalism',
  hardline_nationalism_market_growth_traditional_values: 'Traditionalist Capitalism',
  hardline_nationalism_national_security_social_safety_net: 'Fortress Paternalism',
  hardline_nationalism_national_security_traditional_values: 'The Reactionary Citadel',
  hardline_nationalism_social_safety_net_traditional_values: 'The Traditionalist Family State',

  // Combinations including Identity Equity (IE) - excluding FR, GD, GS, HN
  identity_equity_labor_power_market_growth: 'The Stakeholder Economy',
  identity_equity_labor_power_national_security: 'The Liberated Vanguard',
  identity_equity_labor_power_social_safety_net: 'The Democratic Socialist Utopia',
  identity_equity_labor_power_traditional_values: 'The Progressive Guilds',
  identity_equity_market_growth_national_security: 'The Inclusive Security State',
  identity_equity_market_growth_social_safety_net: 'Progressive Capitalism',
  identity_equity_market_growth_traditional_values: 'The Tolerant Market',
  identity_equity_national_security_social_safety_net: 'The Just Defense Era',
  identity_equity_national_security_traditional_values: 'The Just War Era',
  identity_equity_social_safety_net_traditional_values: 'The Inclusive Hearth',

  // Combinations including Labor Power (LP) - excluding FR, GD, GS, HN, IE
  labor_power_market_growth_national_security: 'The Armory of Capital',
  labor_power_market_growth_social_safety_net: 'The Nordic Model Era',
  labor_power_market_growth_traditional_values: 'The Paternalistic Employers',
  labor_power_national_security_social_safety_net: 'The Industrial Defense Coalition',
  labor_power_national_security_traditional_values: 'The Labor Crusades',
  labor_power_social_safety_net_traditional_values: 'Traditional Trade Unionism',

  // Combinations including Market Growth (MG) - excluding FR, GD, GS, HN, IE, LP
  market_growth_national_security_social_safety_net: 'The Secure Prosperity Era',
  market_growth_national_security_traditional_values: 'The Commercial Crusade',
  market_growth_social_safety_net_traditional_values: 'Compassionate Conservatism',

  // Combinations including National Security (NS) - excluding FR, GD, GS, HN, IE, LP, MG
  national_security_social_safety_net_traditional_values: 'The Paternal Security State',
};
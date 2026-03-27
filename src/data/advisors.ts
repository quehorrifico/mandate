import {
  ADVISOR_IDS,
  type AdvisorId,
  type AdvisorSelectionBias,
  type PolicyPillarKey,
} from '../types';

export interface AdvisorDefinition {
  id: AdvisorId;
  name: string;
  emoji: string;
  pitch: string;
  benefit: string;
  drawback: string;
  favoredPillars: readonly [PolicyPillarKey, PolicyPillarKey];
  bias: AdvisorSelectionBias;
}

/**
 * Advisors only apply draw bias around favored policy pillars.
 * They do not grant direct stat or region effects.
 */
export const ADVISORS: Record<AdvisorId, AdvisorDefinition> = {
  realpolitiker: {
    id: 'realpolitiker',
    name: 'Dr. Victor Kross (The Realpolitiker)',
    emoji: '🧪',
    pitch: 'Political calculus and domestic pacification. Cold, clinical, treats populace as statistical variables.',
    benefit: 'ACTIVE [PACIFICATION]: Once per election term, forcibly pacifies one target governor region. \n\nPASSIVE: Increases frequency of National Security & Hardline Nationalism proposals.',
    drawback: 'LIMITATION: Pacification triggers Sentiment -15 and all other regions lose 10 loyalty. Ability resets each election cycle.',
    favoredPillars: ['national_security', 'hardline_nationalism'],
    bias: {
      pillarMultipliers: {
        national_security: 1.6,
        hardline_nationalism: 1.6,
      },
    },
  },
  revolutionary: {
    id: 'revolutionary',
    name: 'Sade Malik (The Revolutionary)',
    emoji: '🧨',
    pitch: 'Grassroots mobilization and systemic disruption. Sharp-tongued organizer. High risk of ideological subversion.',
    benefit: 'ACTIVE [FIXER]: Authorizes emergency rewriting of pending proposals.\n\nPASSIVE: Increases frequency of Identity Equity & Labor Power proposals.',
    drawback: 'LIMITATION: Active rewrite protocol requires a 10-turn federal cooldown sequence.',
    favoredPillars: ['identity_equity', 'labor_power'],
    bias: {
      pillarMultipliers: {
        identity_equity: 1.6,
        labor_power: 1.6,
      },
    },
  },
  vulture: {
    id: 'vulture',
    name: 'Silas Vane (The Vulture)',
    emoji: '🦅',
    pitch: 'Corporate consolidation and asset liquidation. Amoral dealmaker. Views governance purely through profit margins.',
    benefit: 'ACTIVE [BAILOUT]: When Capital drops to 30% or below, unlocks emergency corporate bailout. Grants Capital +80.\n\nPASSIVE: Increases frequency of Market Growth & Fiscal Restraint proposals.',
    drawback: 'LIMITATION: Bailout triggers Sentiment -60. All unpacified regions gain +20 loyalty except one randomly chosen region which loses -20.',
    favoredPillars: ['market_growth', 'fiscal_restraint'],
    bias: {
      pillarMultipliers: {
        market_growth: 1.6,
        fiscal_restraint: 1.6,
      },
    },
  },
  iron_vance: {
    id: 'iron_vance',
    name: 'Colonel "Iron" Vance (The Hawk)',
    emoji: '🪖',
    pitch: 'Militarized enforcement and border containment. Decorated hardliner. Aggressive operational posture.',
    benefit: 'ACTIVE [MARTIAL LAW]: Authority and Regional Loyalty become locked at 100%.\n\nPASSIVE: Increases frequency of National Security & Traditional Values proposals.',
    drawback: 'LIMITATION: Martial Law comes at the cost of -10 Capital & -10 Sentiment each turn. When terminated, ALL regions immediately become ANGRY (30% Loyalty).',
    favoredPillars: ['national_security', 'traditional_values'],
    bias: {
      pillarMultipliers: {
        national_security: 1.6,
        traditional_values: 1.6,
      },
    },
  },
  spin_doctor: {
    id: 'spin_doctor',
    name: '"Slick" Rick Santana (The Spin Doctor)',
    emoji: '📺',
    pitch: 'Media manipulation and scandal suppression. Optics-obsessed fixer. Masters public distraction.',
    benefit: 'ACTIVE [DAMAGE CONTROL]: Once per turn, authorizes full media suppression campaigns. Grants Sentiment +20 and converts one revolting governor to neutral.\n\nPASSIVE: Increases frequency of Global Diplomacy & Identity Equity proposals.',
    drawback: 'LIMITATION: Suppression campaign costs Capital -25 and triggers Sustainability -25.',
    favoredPillars: ['global_diplomacy', 'identity_equity'],
    bias: {
      pillarMultipliers: {
        global_diplomacy: 1.6,
        identity_equity: 1.6,
      },
    },
  },
  data_broker: {
    id: 'data_broker',
    name: 'Jax Thorne (The Data Broker)',
    emoji: '👁️',
    pitch: 'Deep state surveillance and predictive modeling. Information broker. Knows every secret, but his presence makes the governors paranoid.',
    benefit: 'PASSIVE: Exposes exact regional loyalty impact of each decision.',
    drawback: 'LIMITATION: Governors are highly distrustful. Election survival threshold is increased to 9 votes.',
    favoredPillars: ['national_security', 'fiscal_restraint'],
    bias: {
      pillarMultipliers: {},
    },
  },
};

export const ADVISOR_LIST: AdvisorDefinition[] = ADVISOR_IDS.map((id) => ADVISORS[id]);

export function getAdvisorById(advisorId: AdvisorId | null | undefined): AdvisorDefinition | null {
  if (!advisorId) {
    return null;
  }
  return ADVISORS[advisorId] ?? null;
}

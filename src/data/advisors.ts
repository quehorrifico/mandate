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
    pitch: 'SUBJECT EXPERTISE: Political calculus and domestic pacification. PROFILE: Cold, clinical, treats populace as statistical variables.',
    benefit: 'PASSIVE PROTOCOL: Increases frequency of National Security and Fiscal Restraint proposals by 60%.',
    drawback: 'LIMITATION: Consultative only. No direct executive override capabilities.',
    favoredPillars: ['national_security', 'fiscal_restraint'],
    bias: {
      pillarMultipliers: {
        national_security: 1.6,
        fiscal_restraint: 1.6,
      },
    },
  },
  revolutionary: {
    id: 'revolutionary',
    name: 'Sade Malik (The Revolutionary)',
    emoji: '🧨',
    pitch: 'SUBJECT EXPERTISE: Grassroots mobilization and systemic disruption. PROFILE: Sharp-tongued organizer. High risk of ideological subversion.',
    benefit: 'ACTIVE PROTOCOL [FIXER]: Authorizes emergency rewriting of pending proposals.\nPASSIVE PROTOCOL: Increases frequency of Identity Equity and Labor Power proposals by 60%.',
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
    pitch: 'SUBJECT EXPERTISE: Corporate consolidation and asset liquidation. PROFILE: Amoral dealmaker. Views governance purely through profit margins.',
    benefit: 'PASSIVE PROTOCOL: Increases frequency of Market Growth and Fiscal Restraint proposals by 60%.',
    drawback: 'LIMITATION: Consultative only. No direct executive override capabilities.',
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
    pitch: 'SUBJECT EXPERTISE: Militarized enforcement and border containment. PROFILE: Decorated hardliner. Aggressive operational posture.',
    benefit: 'PASSIVE PROTOCOL: Increases frequency of National Security and Hardline Nationalism proposals by 60%.',
    drawback: 'LIMITATION: Consultative only. No direct executive override capabilities.',
    favoredPillars: ['national_security', 'hardline_nationalism'],
    bias: {
      pillarMultipliers: {
        national_security: 1.6,
        hardline_nationalism: 1.6,
      },
    },
  },
  spin_doctor: {
    id: 'spin_doctor',
    name: '"Slick" Rick Santana (The Spin Doctor)',
    emoji: '📺',
    pitch: 'SUBJECT EXPERTISE: Media manipulation and scandal suppression. PROFILE: Optics-obsessed fixer. Masters public distraction.',
    benefit: 'PASSIVE PROTOCOL: Increases frequency of Global Diplomacy and Identity Equity proposals by 60%.',
    drawback: 'LIMITATION: Consultative only. No direct executive override capabilities.',
    favoredPillars: ['global_diplomacy', 'identity_equity'],
    bias: {
      pillarMultipliers: {
        global_diplomacy: 1.6,
        identity_equity: 1.6,
      },
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

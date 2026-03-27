import {
  type AdvisorSelectionBias,
  type Card,
  type CardType,
  POLICY_PILLAR_KEYS,
  type PolicyPillarKey,
  type HiddenStats,
  type VulnerabilityBucketKey,
} from '../types';
import { HIDDEN_STAT_TO_PILLAR } from './hiddenStats';
import { isBucketVulnerable } from './vulnerabilities';

export const CARD_TYPES = [
  'governor_request',
  'federal_initiative',
  'fallout',
  'cross',
  'maintenance',
  'synth',
] as const;

function isCardType(value: string): value is CardType {
  return (CARD_TYPES as readonly string[]).includes(value as CardType);
}

export function inferCardType(card: Card): CardType {
  if (card.type && isCardType(card.type)) {
    return card.type;
  }

  const id = typeof card.id === 'string' ? card.id : '';
  if (id.startsWith('maint-')) {
    return 'maintenance';
  }
  if (id.startsWith('cross-')) {
    return 'cross';
  }
  if (id.startsWith('synth-')) {
    return 'synth';
  }
  if (id.startsWith('fed-')) {
    return 'federal_initiative';
  }
  return 'governor_request';
}

function getPillarForTag(tag: string): PolicyPillarKey | null {
  if ((POLICY_PILLAR_KEYS as readonly string[]).includes(tag as PolicyPillarKey)) {
    return tag as PolicyPillarKey;
  }
  return (HIDDEN_STAT_TO_PILLAR as Record<string, PolicyPillarKey>)[tag] ?? null;
}

export function scoreCardWeight(params: {
  card: Card;
  advisorBias: AdvisorSelectionBias | undefined;
  hiddenStats?: HiddenStats;
  isSustainabilityMaxed?: boolean;
  endlessTurnOffset?: number;
}): number {
  const { card, advisorBias, hiddenStats, isSustainabilityMaxed, endlessTurnOffset = 0 } = params;

  let weight = 1;
  const multipliers = advisorBias?.pillarMultipliers ?? {};
  const cardTags = card.pillarTags ?? [];
  const seenPillars = new Set<PolicyPillarKey>();

  for (const tag of cardTags) {
    const pillar = getPillarForTag(tag);
    if (!pillar || seenPillars.has(pillar)) {
      continue;
    }
    seenPillars.add(pillar);

    const multiplier = multipliers[pillar];
    // Advisors only add positive bias; they never reduce draw odds.
    if (typeof multiplier === 'number' && Number.isFinite(multiplier) && multiplier > 1) {
      weight *= multiplier;
    }
  }

  // Handle thematic consequence cards
  if (hiddenStats && typeof card.id === 'string' && card.id.startsWith('crisis-')) {
    const bucketStr = card.id.replace('crisis-', '');
    // Assume the bucket format exactly matches the ID suffix (e.g. crisis-public_health_emergency)
    if (isBucketVulnerable(hiddenStats, bucketStr as VulnerabilityBucketKey)) {
      weight *= 10;
    }
    
    // Sustainability passive cuts crisis card base weight
    if (isSustainabilityMaxed) {
      weight *= 0.5;
    }

    // In endless mode, the weight of crisis cards creeps up based on turns past 75
    if (endlessTurnOffset > 0) {
      weight *= 1 + endlessTurnOffset * 0.1; // +10% per turn passed
    }
  }

  return Math.max(0.001, weight);
}

export function chooseWeightedCard<T>(
  items: T[],
  getWeight: (item: T) => number,
  rng: () => number = Math.random,
): T | null {
  if (!items.length) {
    return null;
  }

  let totalWeight = 0;
  const weighted = items.map((item) => {
    const weight = Math.max(0, getWeight(item));
    totalWeight += weight;
    return { item, weight };
  });

  if (totalWeight <= 0) {
    return items[0];
  }

  let threshold = rng() * totalWeight;
  for (const entry of weighted) {
    threshold -= entry.weight;
    if (threshold <= 0) {
      return entry.item;
    }
  }

  return weighted[weighted.length - 1].item;
}

export function selectPolicyCardFromDeck(params: {
  deck: string[];
  advisorBias: AdvisorSelectionBias | undefined;
  cardsById: Map<string, Card>;
  hiddenStats: HiddenStats;
  rng?: () => number;
  isSustainabilityMaxed?: boolean;
  endlessTurnOffset?: number;
}): { cardId: string; chosenType: CardType } | null {
  const { deck, advisorBias, cardsById, hiddenStats, rng = Math.random, isSustainabilityMaxed, endlessTurnOffset = 0 } = params;

  const candidates: Array<{ cardId: string; card: Card; cardType: CardType }> = [];
  for (const cardId of deck) {
    const card = cardsById.get(cardId);
    if (!card) {
      continue;
    }
    candidates.push({ cardId, card, cardType: inferCardType(card) });
  }

  if (candidates.length === 0) {
    return null;
  }

  /* 
    FUTURE FEATURE: Sustainability Passive (Resilience Buffer)
    If Sustainability is at 100, the probability of drawing 
    'Crisis' cards should be halved.
  */
  const selected = chooseWeightedCard(
    candidates,
    (entry) =>
      scoreCardWeight({
        card: entry.card,
        advisorBias,
        hiddenStats,
        isSustainabilityMaxed,
        endlessTurnOffset,
      }),
    rng,
  );

  if (!selected) {
    return null;
  }

  return {
    cardId: selected.cardId,
    chosenType: selected.cardType,
  };
}

export function applyDeckSelection(deck: string[], selectedCardId: string): string[] {
  if (!selectedCardId) {
    return [...deck];
  }
  return deck.filter((cardId) => cardId !== selectedCardId);
}

export function createSeededRng(seed: number): () => number {
  let state = Math.floor(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const positive = Math.abs(state);
    return (positive % 1_000_000) / 1_000_000;
  };
}

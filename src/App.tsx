import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdvisorAction } from './components/AdvisorAction';
import { DecisionCard } from './components/DecisionCard';
import { GameOver } from './components/GameOver';
import { StatsBar } from './components/StatsBar';
import { ADVISOR_LIST, getAdvisorById } from './data/advisors';
import cardsData from './data/cards.json';
import reactionCardsData from './data/reaction_cards.json';
import { GOVERNORS } from './data/governors';
import {
  applyDeckSelection,
  createSeededRng,
  inferCardType,
  selectPolicyCardFromDeck,
} from './lib/cardSelection';
import {
  applyChoiceToStats,
  logResolutionDebug,
  normalizeCard,
  resolveCardDecision,
  type DecisionResolutionResult,
} from './lib/cardResolution';
import { resolveEnding } from './lib/endings';
import { createInitialHiddenStats } from './lib/hiddenStats';
import { clearGameState, loadGameState, saveGameState } from './lib/storage';
import {
  REGION_KEYS,
  getRegionLoyaltyState,
  isAdvisorId,
  STAT_KEYS,
  HIDDEN_STAT_KEYS,
  type AdvisorId,
  type AdvisorSelectionBias,
  type Card,
  type Direction,
  type GameOverReason,
  type GameState,
  type HiddenStats,
  type HiddenStatKey,
  type RawCard,
  type RegionKey,
  type RegionLoyaltyByRegion,
  type StatKey,
  type Stats,
  type StatBuffers,
  type ReactionCard,
  MANDATES,
  type PolicyPillarKey,
} from './types';

const ALL_POLICY_CARDS = (cardsData as RawCard[])
  .map((rawCard) => normalizeCard(rawCard))
  .filter((card): card is Card => Boolean(card))
  .map((card) => ({
    ...card,
    type: card.type ?? inferCardType(card),
  }));

const HEADLINE_DURATION_MS = 3000;
const FULL_TERM_TURNS = 75;
const TERM_CARD_COUNT = 25;
const ELECTION_INTERVAL = 25;
const ELECTION_MAJORITY = Math.floor(REGION_KEYS.length / 2) + 1;

const ALL_REACTION_CARDS = (reactionCardsData as RawCard[])
  .map((rawCard) => normalizeCard(rawCard) as ReactionCard | null)
  .filter((card): card is ReactionCard => Boolean(card))
  .map((card) => {
    const raw = reactionCardsData.find((r) => r.id === card.id) as any;
    return {
      ...card,
      type: card.type ?? inferCardType(card),
      requiredFlags: raw.requiredFlags,
      requiredAdvisorId: raw.requiredAdvisorId,
    };
  });

const POLICY_CARD_BY_ID = new Map<string, Card>([
  ...ALL_POLICY_CARDS.map((card) => [card.id, card] as const),
  ...ALL_REACTION_CARDS.map((card) => [card.id, card] as const),
]);

const INITIAL_STATS: Stats = {
  authority: 80,
  capital: 80,
  sentiment: 80,
  sustainability: 40,
};

const INITIAL_STAT_BUFFERS: StatBuffers = {
  authority: 0,
  capital: 0,
  sentiment: 0,
  sustainability: 0,
};

const INITIAL_HIDDEN_STATS: HiddenStats = createInitialHiddenStats();

interface GovernorMood {
  emoji: string;
  label: string;
}

interface ElectionVote {
  region: (typeof REGION_KEYS)[number];
  loyalty: number;
  mood: GovernorMood;
}

interface ElectionResult {
  turn: number;
  votesFor: number;
  votesAgainst: number;
  passed: boolean;
  forVotes: ElectionVote[];
  againstVotes: ElectionVote[];
}

function getGovernorMood(loyalty: number): GovernorMood {
  const state = getRegionLoyaltyState(loyalty);
  if (state === 'revolt') {
    return { emoji: '🤬', label: 'Revolt' };
  }
  if (state === 'angry') {
    return { emoji: '😠', label: 'Angry' };
  }
  if (state === 'neutral') {
    return { emoji: '😐', label: 'Neutral' };
  }
  if (state === 'supportive') {
    return { emoji: '😃', label: 'Supportive' };
  }
  return { emoji: '😍', label: 'Loyalist' };
}

function getCurrentTerm(turn: number): number {
  return Math.floor(turn / TERM_CARD_COUNT) + 1;
}


function createInitialRegionLoyalty(): RegionLoyaltyByRegion {
  const loyalty = {} as RegionLoyaltyByRegion;
  for (const region of REGION_KEYS) {
    loyalty[region] = 45 + Math.floor(Math.random() * 21);
  }
  return loyalty;
}

function createPolicyDeck(): string[] {
  return ALL_POLICY_CARDS.map((card) => card.id);
}

function selectNextCard(
  deck: string[],
  advisorBias: AdvisorSelectionBias | undefined,
  hiddenStats: HiddenStats,
  rng: () => number,
  flags: string[],
  advisorId: AdvisorId | null,
  isSustainabilityMaxed: boolean = false,
  endlessTurnOffset: number = 0,
): { deck: string[]; cardId: string | null } {
  const validReactionCards = ALL_REACTION_CARDS.filter((rc) => {
    if (flags.includes(`seen_${rc.id}`)) return false;
    if (rc.requiredAdvisorId && rc.requiredAdvisorId !== advisorId) return false;
    if (rc.requiredFlags && !rc.requiredFlags.every((f: string) => flags.includes(f))) return false;
    return true;
  });

  if (validReactionCards.length > 0 && rng() < 0.3) {
    const chosen = validReactionCards[Math.floor(rng() * validReactionCards.length)];
    return { deck, cardId: chosen.id };
  }

  if (deck.length === 0) {
    return { deck, cardId: null };
  }

  const selected = selectPolicyCardFromDeck({
    deck,
    advisorBias,
    cardsById: POLICY_CARD_BY_ID,
    hiddenStats,
    rng,
    isSustainabilityMaxed,
    endlessTurnOffset,
  });

  if (!selected?.cardId) {
    return { deck, cardId: null };
  }

  return {
    deck: applyDeckSelection(deck, selected.cardId),
    cardId: selected.cardId,
  };
}

function createNewGameState(advisorId: AdvisorId | null = null): GameState {
  const deck = createPolicyDeck();
  const advisor = getAdvisorById(advisorId);
  const firstSelection = selectNextCard(deck, advisor?.bias, INITIAL_HIDDEN_STATS, Math.random, [], advisorId, false, 0);

  return {
    advisorId,
    stats: { ...INITIAL_STATS },
    statBuffers: { ...INITIAL_STAT_BUFFERS },
    hiddenStats: { ...INITIAL_HIDDEN_STATS },
    corruption: 0,
    regionLoyalty: createInitialRegionLoyalty(),
    turn: 0,
    deck: firstSelection.deck,
    currentCardId: firstSelection.cardId,
    headline: null,
    endingSummary: null,
    gameOver: false,
    gameOverReason: null,
    malikCooldown: 0,
    malikRewriteActive: false,
    pacifiedRegions: [],
    krossLastUsedElectionTerm: null,
    santanaLastUsedElectionTerm: null,
    santanaLastUsedTurn: null,
    martialLawActive: false,
    unlockedDirection: null,
    activeUnlock: null,
    flags: [],
    activeMandate: null,
    pillarTallies: {
      social_safety_net: 0,
      green_stewardship: 0,
      global_diplomacy: 0,
      hardline_nationalism: 0,
      market_growth: 0,
      identity_equity: 0,
      labor_power: 0,
      fiscal_restraint: 0,
      national_security: 0,
      traditional_values: 0,
    },
    endlessMode: false,
    showFinaleChoice: false,
  };
}

type StatFailureReason = 'authority' | 'capital' | 'sustainability' | 'sentiment';

function getCollapseReason(stats: Stats): StatFailureReason | null {
  if (stats.authority <= 0) {
    return 'authority';
  }
  if (stats.capital <= -100) {
    return 'capital';
  }
  if (stats.sustainability <= 0) {
    return 'sustainability';
  }
  if (stats.sentiment <= 0) {
    return 'sentiment';
  }
  return null;
}

function getCollapseHeadline(reason: StatFailureReason): string {
  if (reason === 'authority') {
    return 'The regions stop taking federal calls. The republic starts to splinter.';
  }
  if (reason === 'capital') {
    return "Capital hit -100. Federal credit imploded and asset fire-sales began immediately.";
  }
  if (reason === 'sustainability') {
    return 'Grid failures and breakdowns outrun federal response capacity.';
  }
  return 'Sentiment collapsed so hard that even your allies turned into rivals.';
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function getStatHintLabel(statKey: StatKey): string {
  if (statKey === 'authority') {
    return 'Authority';
  }
  if (statKey === 'capital') {
    return 'Capital';
  }
  if (statKey === 'sustainability') {
    return 'Sustainability';
  }
  return 'Sentiment';
}

function buildOutcomeHint(resolution: DecisionResolutionResult, card: Card): string | null {
  if (!resolution.ok) {
    return null;
  }

  const parts: string[] = [];
  const topStats = [...resolution.changes.visibleStatChanges]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2);
  if (topStats.length > 0) {
    parts.push(
      topStats
        .map((change) => `${getStatHintLabel(change.key as StatKey)} ${formatSigned(change.delta)}`)
        .join(', '),
    );
  }

  if (card.governor) {
    const governorShift = resolution.changes.regionSupportChanges.find((change) => change.key === card.governor);
    if (governorShift && governorShift.delta !== 0) {
      const governor = GOVERNORS[card.governor];
      parts.push(`${governor.futureRegionName} loyalty ${formatSigned(governorShift.delta)}`);
    }
  }

  return parts.length > 0 ? `Outcome: ${parts.join(' • ')}` : null;
}

function getEndingSummary(params: {
  reason: GameOverReason;
  stats: Stats;
  hiddenStats: HiddenStats;
  turn: number;
}): string {
  const { reason, stats, hiddenStats, turn } = params;
  const ending = resolveEnding({ stats, hiddenStats });
  const tenure = reason === 'completed' ? 'Mandate complete.' : `Mandate ended on card ${turn}.`;
  return `${ending.definition.title}\n\n${ending.modularLegacy}\n\n${tenure}`;
}

function getNoConfidenceResult(turn: number, regionLoyalty: RegionLoyaltyByRegion, threshold: number, isSentimentMaxed: boolean): ElectionResult {
  const forVotes: ElectionVote[] = [];
  const againstVotes: ElectionVote[] = [];
  for (const region of REGION_KEYS) {
    let loyalty = regionLoyalty[region] ?? 0;

    // Sentiment Passive: Mandate Buffer
    // Static blanket +10 Loyalty boost when Sentiment is maxed
    if (isSentimentMaxed) {
      loyalty = Math.min(100, loyalty + 10);
    }

    const mood = getGovernorMood(loyalty);
    const state = getRegionLoyaltyState(loyalty);
    if (state === 'neutral' || state === 'supportive' || state === 'loyalist') {
      forVotes.push({ region, loyalty, mood });
    } else {
      againstVotes.push({ region, loyalty, mood });
    }
  }

  const votesFor = forVotes.length;
  const votesAgainst = againstVotes.length;
  return {
    turn,
    votesFor,
    votesAgainst,
    passed: votesFor >= threshold,
    forVotes,
    againstVotes,
  };
}

function getElectionRegionLabel(region: (typeof REGION_KEYS)[number]): string {
  return GOVERNORS[region]?.futureRegionName ?? region.replace(/_/g, ' ');
}

export default function App() {
  const [game, setGame] = useState<GameState>(() => loadGameState() ?? createNewGameState());
  const [govSortMode, setGovSortMode] = useState<'default' | 'loyalty'>('default');
  const [previewDirection, setPreviewDirection] = useState<Direction | null>(null);
  const [advisorInfoOpen, setAdvisorInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeMobileTooltip, setActiveMobileTooltip] = useState<{ title: string, body: string, cssClass: string } | null>(null);

  const handleMobileTooltipClick = (title: string, body: string, cssClass: string) => {
    if (typeof window !== 'undefined' && window.innerWidth <= 850) {
      setActiveMobileTooltip({ title, body, cssClass });
    }
  };
  const [electionModal, setElectionModal] = useState<ElectionResult | null>(null);
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try { return !window.sessionStorage.getItem('fra-intro-seen'); } catch { return true; }
  });

  const drawRng = useMemo(() => {
    if (typeof window === 'undefined') {
      return Math.random;
    }
    try {
      const seedRaw = window.localStorage.getItem('fra-seed');
      if (!seedRaw) {
        return Math.random;
      }
      const seed = Number(seedRaw);
      if (!Number.isFinite(seed)) {
        return Math.random;
      }
      return createSeededRng(seed);
    } catch {
      return Math.random;
    }
  }, []);

  const drawDebugEnabled = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem('fra-debug-draw') === '1';
    } catch {
      return false;
    }
  }, []);

  const resolutionDebugEnabled = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem('fra-debug-resolution') === '1';
    } catch {
      return false;
    }
  }, []);

  const currentCard = useMemo(
    () => (game.currentCardId ? POLICY_CARD_BY_ID.get(game.currentCardId) ?? null : null),
    [game.currentCardId],
  );

  const selectedAdvisor = useMemo(
    () => (game.advisorId && isAdvisorId(game.advisorId) ? getAdvisorById(game.advisorId) : null),
    [game.advisorId],
  );

  const sortedRegions = useMemo(() => {
    const list = [...REGION_KEYS];
    if (govSortMode === 'loyalty') {
      return list.sort((a, b) => (game.regionLoyalty[b] ?? 0) - (game.regionLoyalty[a] ?? 0));
    }
    return list; // default is order in REGION_KEYS
  }, [game.regionLoyalty, govSortMode]);

  const advisorBias = selectedAdvisor?.bias;
  const needsAdvisorSelection = !selectedAdvisor && game.turn === 0 && !game.gameOver;
  const turnsUntilElection = useMemo(() => ELECTION_INTERVAL - (game.turn % ELECTION_INTERVAL), [game.turn]);
  const currentTerm = useMemo(() => getCurrentTerm(game.turn), [game.turn]);
  const previewState = useMemo(() => {
    if (!previewDirection || !currentCard || game.gameOver) {
      return undefined;
    }

    const resolution = resolveCardDecision({
      state: {
        stats: game.stats,
        statBuffers: game.statBuffers,
        hiddenStats: game.hiddenStats,
        regionLoyalty: game.regionLoyalty,
        malikRewriteActive: game.malikRewriteActive,
        pacifiedRegions: game.pacifiedRegions,
        flags: game.flags,
        activeMandate: game.activeMandate,
        pillarTallies: game.pillarTallies,
      },
      card: currentCard,
      direction: previewDirection,
    });

    const nextStats = { ...resolution.next.stats };
    const nextBuffers = { ...resolution.next.statBuffers };

    if (game.martialLawActive) {
      const isCrisis = typeof currentCard.id === 'string' && currentCard.id.startsWith('crisis-');

      if (isCrisis) {
        // Iron Vance nullifies negative stat drops from crisis cards
        STAT_KEYS.forEach((k) => {
          if (nextStats[k] < game.stats[k]) {
            nextStats[k] = game.stats[k];
          }
        });
        /* 
         Note: We do not preview hiddenStats or regionLoyalty visually, 
         so we only need to restore core stats (authority, capital, sentiment, sustainability) 
         for the UI metric preview.
        */
      }

      nextStats.authority = 100;
      nextStats.capital = Math.max(0, game.stats.capital - 10);
      nextStats.sentiment = Math.max(0, game.stats.sentiment - 10);
    }

    return { stats: nextStats, buffers: nextBuffers };
    return { stats: nextStats, buffers: nextBuffers };
  }, [currentCard, game.gameOver, game.stats, game.statBuffers, game.hiddenStats, game.regionLoyalty, game.malikRewriteActive, game.martialLawActive, previewDirection]);

  const activeCoalitions = useMemo(() => {
    if (currentTerm < 2) return [];

    const lowStats = HIDDEN_STAT_KEYS.filter((s) => game.hiddenStats[s] < 10);
    if (lowStats.length === 0) return [];

    // Filter for stats that are actually shared by 2 or more governors
    const statsWithBlocs = lowStats.filter((s) => {
      const governorCount = REGION_KEYS.filter((r) => GOVERNORS[r].proHiddenStats.includes(s)).length;
      return governorCount >= 2;
    });

    if (statsWithBlocs.length === 0) return [];

    // Pick the SINGLE WORST stat among those that have a multi-governor bloc
    const sorted = statsWithBlocs.sort((a, b) => (game.hiddenStats[a] as number) - (game.hiddenStats[b] as number));
    return [sorted[0]];
  }, [game.hiddenStats]);

  const coalitionGovernors = useMemo(() => {
    return REGION_KEYS.filter((r) =>
      GOVERNORS[r].proHiddenStats.some((s) => activeCoalitions.includes(s))
    );
  }, [activeCoalitions]);

  const isBlocked = useCallback(
    (choice: import('./types').CardChoice | undefined) => {
      if (!choice || !choice.hiddenEffects) return false;
      return Object.entries(choice.hiddenEffects).some(
        ([stat, delta]) =>
          (delta as number) < 0 && activeCoalitions.includes(stat as HiddenStatKey)
      );
    },
    [activeCoalitions]
  );

  const leftBlocked = currentCard ? isBlocked(currentCard.left) : false;
  const rightBlocked = currentCard ? isBlocked(currentCard.right) : false;



  const canBribe = currentTerm >= 3 && game.stats.capital >= 20 && game.corruption < 100;
  const canForce = (game.statBuffers.authority ?? 0) >= 10 && game.stats.authority === 100;

  const handleBribe = useCallback((direction: Direction) => {
    if (!canBribe || game.unlockedDirection === direction) return;
    setGame(prev => {
      const nextCorruption = (prev.corruption ?? 0) + 15;
      if (nextCorruption >= 100) {
        return {
          ...prev,
          corruption: nextCorruption,
          gameOver: true,
          gameOverReason: 'impeachment',
          headline: 'Administration collapsed due to exposed corruption.',
          endingSummary: getEndingSummary({
            reason: 'impeachment',
            stats: prev.stats,
            hiddenStats: prev.hiddenStats,
            turn: prev.turn,
          })
        };
      }
      return {
        ...prev,
        stats: {
          ...prev.stats,
          capital: Math.max(0, prev.stats.capital - 20)
        },
        corruption: nextCorruption,
        unlockedDirection: direction,
        activeUnlock: 'bribe'
      };
    });
  }, [canBribe, game.unlockedDirection]);

  const handleForce = useCallback((direction: Direction) => {
    if (!canForce || game.unlockedDirection === direction) return;
    setGame(prev => ({
      ...prev,
      statBuffers: {
        ...prev.statBuffers,
        authority: Math.max(0, (prev.statBuffers.authority ?? 0) - 10)
      },
      unlockedDirection: direction,
      activeUnlock: 'force'
    }));
  }, [canForce, game.unlockedDirection]);

  const dismissElectionModal = useCallback(() => {
    setElectionModal(null);
  }, []);

  const electionModalUi = electionModal ? (
    <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Election results">
      <div className="settings-modal-panel" style={{ maxWidth: '600px' }}>
        <h2 className="glow-amber" style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginTop: 0 }}>[ NO-CONFIDENCE VOTE RESULTS ]</h2>
        {selectedAdvisor?.id === 'data_broker' && (
          <p className="glow-amber" style={{ fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '1rem' }}>
            WARNING: ELECTION THRESHOLD INCREASED DUE TO SURVEILLANCE PROTOCOLS (REQUIRES 9 VOTES)
          </p>
        )}
        <p>
          <span className={electionModal.passed ? 'glow-green' : 'gov-status-revolt'}>{electionModal.passed ? 'VOTE SURVIVED' : 'VOTE FAILED'}</span> (
          {electionModal.votesFor}-{electionModal.votesAgainst})
        </p>
        <div className="responsive-grid" style={{ gap: '2rem', marginTop: '1rem', marginBottom: '2rem' }}>
          <div>
            <p className="glow-green" style={{ textDecoration: 'underline', marginBottom: '0.5rem', fontSize: '0.8rem' }}>VOTES FOR</p>
            <ul className="gov-list">
              {electionModal.forVotes.map((vote) => (
                <li key={`for-${vote.region}`} className="gov-item">
                  <span className="glow-green">{getElectionRegionLabel(vote.region).toUpperCase()}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="gov-status-revolt" style={{ textDecoration: 'underline', marginBottom: '0.5rem', fontSize: '0.8rem' }}>VOTES AGAINST</p>
            <ul className="gov-list">
              {electionModal.againstVotes.map((vote) => (
                <li key={`against-${vote.region}`} className="gov-item">
                  <span className="gov-status-revolt">{getElectionRegionLabel(vote.region).toUpperCase()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="settings-actions">
          <button className="advisor-action-btn" type="button" onClick={dismissElectionModal}>
            [ DISMISS ]
          </button>
        </div>
      </div>
    </section>
  ) : null;

  const startNewGame = useCallback(() => {
    clearGameState();
    setSettingsOpen(false);
    setPreviewDirection(null);
    setElectionModal(null);
    try { window.sessionStorage.removeItem('fra-intro-seen'); } catch { /* ignore */ }
    setShowIntro(true);
  }, [setShowIntro]);

  const selectAdvisor = useCallback((advisorId: AdvisorId) => {
    clearGameState();
    setSettingsOpen(false);
    setPreviewDirection(null);
    setElectionModal(null);
    setGame(createNewGameState(advisorId));
  }, []);

  const onAdvisorAction = useCallback(() => {
    if (!selectedAdvisor || game.gameOver || !currentCard) {
      return;
    }

    if (selectedAdvisor.id === 'revolutionary') {
      if (game.malikCooldown > 0) return;

      setGame((current) => ({
        ...current,
        malikRewriteActive: true,
        malikCooldown: 10, // 10 turns cooldown (won't decrement until NEXT card swipe)
        headline: '[ SYSTEM OVERRIDE: PROPOSAL REWRITTEN ]',
      }));
    }

    if (selectedAdvisor.id === 'realpolitiker') {
      const currentElectionTerm = Math.floor(game.turn / ELECTION_INTERVAL);
      const krossAvailable = game.krossLastUsedElectionTerm === null || game.krossLastUsedElectionTerm < currentElectionTerm;

      if (!krossAvailable || !currentCard.governor || game.pacifiedRegions.includes(currentCard.governor)) {
        return;
      }

      setGame((current) => {
        const nextStats = { ...current.stats };
        nextStats.sentiment = Math.max(0, nextStats.sentiment - 15);
        nextStats.authority = Math.min(100, nextStats.authority + 30);

        const nextRegionLoyalty = { ...current.regionLoyalty };
        // Decrease all regions by 10
        for (const r of REGION_KEYS) {
          nextRegionLoyalty[r] = Math.max(0, (nextRegionLoyalty[r] ?? 50) - 10);
        }

        // Set the targeted pacified region to 100 loyalty and lock it.
        nextRegionLoyalty[currentCard.governor!] = 100;

        return {
          ...current,
          stats: nextStats,
          regionLoyalty: nextRegionLoyalty,
          pacifiedRegions: [...current.pacifiedRegions, currentCard.governor!],
          krossLastUsedElectionTerm: currentElectionTerm,
          headline: `[ REGIONAL PACIFICATION EXECUTED: TARGET SUPPRESSED ]`,
        };
      });
    }

    if (selectedAdvisor.id === 'vulture') {
      if (game.stats.capital > 30) return;

      setGame((current) => {
        const nextStats = { ...current.stats };
        nextStats.sentiment = Math.max(0, nextStats.sentiment - 60);
        nextStats.capital = Math.min(100, nextStats.capital + 80);

        const nextRegionLoyalty = { ...current.regionLoyalty };
        const unpacifiedRegions = REGION_KEYS.filter(r => !current.pacifiedRegions.includes(r));

        if (unpacifiedRegions.length > 0) {
          const randomRegion = unpacifiedRegions[Math.floor(Math.random() * unpacifiedRegions.length)];

          for (const r of unpacifiedRegions) {
            if (r === randomRegion) {
              nextRegionLoyalty[r] = Math.max(0, (nextRegionLoyalty[r] ?? 50) - 20);
            } else {
              nextRegionLoyalty[r] = Math.min(100, (nextRegionLoyalty[r] ?? 50) + 20);
            }
          }
        }

        return {
          ...current,
          stats: nextStats,
          regionLoyalty: nextRegionLoyalty,
          headline: `[ CORPORATE BAILOUT EXECUTED: TREASURY REPLENISHED ]`,
        };
      });
    }
    if (selectedAdvisor.id === 'spin_doctor') {
      if (game.santanaLastUsedTurn === game.turn) return;

      setGame((current) => {
        const nextStats = { ...current.stats };
        nextStats.capital = Math.max(0, current.stats.capital - 25);
        nextStats.sentiment = Math.min(100, current.stats.sentiment + 20);
        nextStats.sustainability = Math.max(0, current.stats.sustainability - 25);

        // Convert the worst revolting/angry governor back to neutral (loyalty = 50)
        const nextRegionLoyalty = { ...current.regionLoyalty };
        const disloyal = REGION_KEYS
          .filter(r => !current.pacifiedRegions.includes(r))
          .filter(r => (nextRegionLoyalty[r] ?? 50) < 46)
          .sort((a, b) => (nextRegionLoyalty[a] ?? 50) - (nextRegionLoyalty[b] ?? 50));

        if (disloyal.length > 0) {
          nextRegionLoyalty[disloyal[0]] = 50;
        }

        return {
          ...current,
          stats: nextStats,
          regionLoyalty: nextRegionLoyalty,
          santanaLastUsedTurn: current.turn,
          headline: 'DAMAGE CONTROL INITIATED (+20 SENTIMENT, -25 SUSTAINABILITY)',
        };
      });
    }

    if (selectedAdvisor.id === 'iron_vance') {
      setGame((current) => {
        // If turning it OFF
        if (current.martialLawActive) {
          const nextRegionLoyalty = { ...current.regionLoyalty };
          REGION_KEYS.forEach((r) => {
            nextRegionLoyalty[r] = 30; // All regions go to "Angry"
          });

          return {
            ...current,
            martialLawActive: false,
            regionLoyalty: nextRegionLoyalty,
            headline: `[ MARTIAL LAW TERMINATED: POPULACE IN REVOLT ]`,
          };
        }

        // If turning it ON
        const nextStats = { ...current.stats };
        nextStats.authority = 100;

        const nextRegionLoyalty = { ...current.regionLoyalty };
        REGION_KEYS.forEach((r) => {
          nextRegionLoyalty[r] = 100;
        });

        return {
          ...current,
          stats: nextStats,
          regionLoyalty: nextRegionLoyalty,
          martialLawActive: true,
          headline: `[ MARTIAL LAW DEPLOYED: ALL UNITS MOBILIZED ]`,
        };
      });
    }
  }, [selectedAdvisor, game.gameOver, game.malikCooldown, currentCard, game.turn, game.krossLastUsedElectionTerm, game.santanaLastUsedElectionTerm, game.pacifiedRegions, game.santanaLastUsedTurn]);

  const onChoose = useCallback(
    (direction: Direction) => {
      if (game.gameOver || !currentCard) {
        return;
      }

      if (direction === 'left' && leftBlocked && game.unlockedDirection !== 'left') return;
      if (direction === 'right' && rightBlocked && game.unlockedDirection !== 'right') return;

      const resolution = resolveCardDecision({
        state: {
          stats: game.stats,
          statBuffers: game.statBuffers,
          hiddenStats: game.hiddenStats,
          regionLoyalty: game.regionLoyalty,
          malikRewriteActive: game.malikRewriteActive,
          pacifiedRegions: game.pacifiedRegions,
          flags: game.flags,
          activeMandate: game.activeMandate,
          pillarTallies: game.pillarTallies,
        },
        card: currentCard,
        direction,
      });

      if (resolutionDebugEnabled) {
        logResolutionDebug(resolution, {
          cardId: currentCard.id,
          turn: game.turn,
          direction,
        });
      }

      if (!resolution.ok) {
        setGame((current) => ({
          ...current,
          headline: resolution.reason ?? 'Decision could not be resolved.',
        }));
        setPreviewDirection(null);
        return;
      }

      let nextStats = { ...resolution.next.stats };
      const nextBuffers = { ...resolution.next.statBuffers };
      const nextHiddenStats = { ...resolution.next.hiddenStats };
      const nextRegionLoyalty = { ...resolution.next.regionLoyalty };

      if (game.martialLawActive) {
        const isCrisis = typeof currentCard.id === 'string' && currentCard.id.startsWith('crisis-');

        if (isCrisis) {
          // Iron Vance nullifies negative stat drops from crisis cards
          STAT_KEYS.forEach((k) => {
            if (nextStats[k] < game.stats[k]) {
              nextStats[k] = game.stats[k];
            }
          });
          HIDDEN_STAT_KEYS.forEach((k) => {
            if (nextHiddenStats[k] < game.hiddenStats[k]) {
              nextHiddenStats[k] = game.hiddenStats[k];
            }
          });
          REGION_KEYS.forEach((k) => {
            if (nextRegionLoyalty[k] < game.regionLoyalty[k]) {
              nextRegionLoyalty[k] = game.regionLoyalty[k];
            }
          });
        }

        // High per-turn resource drain, ignoring card effects for these specifically
        nextStats.capital = Math.max(0, game.stats.capital - 10);
        nextStats.sentiment = Math.max(0, game.stats.sentiment - 10);

        // Force Authority and all Region Loyalty to 100
        nextStats.authority = 100;
        REGION_KEYS.forEach((r) => {
          nextRegionLoyalty[r] = 100;
        });

        // "Pump up" nationalist metrics
        const nationalistKeys: HiddenStatKey[] = [
          'security', 'military_strength', 'fighting_crime_terrorism',
          'containing_immigration', 'nationalism', 'white_supremacy',
          'tradition', 'christianity', 'rural_life'
        ];
        nationalistKeys.forEach((k) => {
          nextHiddenStats[k] = Math.min(100, nextHiddenStats[k] + 5);
        });

        // "Hurt" progressive metrics
        const progressiveKeys: HiddenStatKey[] = [
          'workers_rights', 'job_creation', 'unionization',
          'world_peace', 'internationalism', 'global_justice',
          'welfare_state', 'public_services', 'universal_healthcare', 'poverty_relief'
        ];
        progressiveKeys.forEach((k) => {
          nextHiddenStats[k] = Math.max(0, nextHiddenStats[k] - 5);
        });
      }

      // --- COALITION SYNC LOGIC ---
      const activeLowStats = HIDDEN_STAT_KEYS.filter((s) => nextHiddenStats[s] < 10);
      const statsWithBlocs = activeLowStats.filter((s) => {
        const governorCount = REGION_KEYS.filter((r) => GOVERNORS[r].proHiddenStats.includes(s)).length;
        return governorCount >= 2;
      });

      let syncGovernors: RegionKey[] = [];
      if (statsWithBlocs.length > 0) {
        // Pick the primary active grievance for synchronizing loyalty
        const worstStat = statsWithBlocs.sort((a, b) => (nextHiddenStats[a] as number) - (nextHiddenStats[b] as number))[0];
        syncGovernors = REGION_KEYS.filter((r) => GOVERNORS[r].proHiddenStats.includes(worstStat));
      }

      if (syncGovernors.length > 0) {
        let collectiveDelta = 0;
        if (resolution.changes.regionSupportChanges) {
          for (const change of resolution.changes.regionSupportChanges) {
            if (syncGovernors.includes(change.key)) {
              collectiveDelta += change.delta;
            }
          }
        }

        let baseLoyalty = 100;
        for (const g of syncGovernors) {
          baseLoyalty = Math.min(baseLoyalty, game.regionLoyalty[g] ?? 50);
        }

        // If the coalition is newly formed or includes new members not in revolt, 
        // collapse their collective loyalty to the 'revolt' threshold (15).
        if (baseLoyalty > 20) {
          baseLoyalty = 15;
        }

        const newSyncedLoyalty = Math.max(0, Math.min(100, baseLoyalty + collectiveDelta));
        for (const g of syncGovernors) {
          nextRegionLoyalty[g] = newSyncedLoyalty;
        }
      }
      // ----------------------------

      const nextTurn = game.turn + 1;
      const outcomeHint = buildOutcomeHint(resolution, currentCard);

      // Decrease cooldown on every card swipe.
      // Because activating the rewrite *sets* the cooldown to 5, the swipe that consumed the rewrite
      // immediately drops it to 4, which perfectly represents "4 turns left before it can activate again".
      const nextMalikCooldown = Math.max(0, game.malikCooldown - 1);

      const collapseReason = getCollapseReason(nextStats);
      if (collapseReason) {
        const endingSummary = getEndingSummary({
          reason: collapseReason,
          stats: nextStats,
          hiddenStats: nextHiddenStats,
          turn: nextTurn,
        });

        setGame({
          ...game,
          stats: nextStats,
          hiddenStats: nextHiddenStats,
          regionLoyalty: nextRegionLoyalty,
          turn: nextTurn,
          currentCardId: null,
          headline: getCollapseHeadline(collapseReason),
          endingSummary,
          gameOver: true,
          gameOverReason: collapseReason,
        });
        setPreviewDirection(null);
        return;
      }

      // Reset unlock state on card swipe - now handled inside setGame


      let electionHeadline: string | null = null;
      let nextPillarTallies: Record<PolicyPillarKey, number> | null = null;
      let nextActiveMandate: PolicyPillarKey | null = null;

      if (nextTurn % ELECTION_INTERVAL === 0 && nextTurn < FULL_TERM_TURNS) {
        const threshold = selectedAdvisor?.id === 'data_broker' ? 9 : ELECTION_MAJORITY;
        const noConfidence = getNoConfidenceResult(nextTurn, nextRegionLoyalty, threshold, nextStats.sentiment === 100);
        setElectionModal(noConfidence);
        if (!noConfidence.passed) {
          const endingSummary = getEndingSummary({
            reason: 'no_confidence',
            stats: nextStats,
            hiddenStats: nextHiddenStats,
            turn: nextTurn,
          });

          setGame({
            ...game,
            stats: nextStats,
            hiddenStats: nextHiddenStats,
            regionLoyalty: nextRegionLoyalty,
            turn: nextTurn,
            currentCardId: null,
            headline: `Vote of no confidence failed (${noConfidence.votesFor}-${noConfidence.votesAgainst}).`,
            endingSummary,
            gameOver: true,
            gameOverReason: 'no_confidence',
          });
          setPreviewDirection(null);
          return;
        }

        nextPillarTallies = { ...resolution.next.pillarTallies };
        nextActiveMandate = game.activeMandate;

        // MANDATE CALCULATION (10 or more loyal regions)
        if (noConfidence.votesAgainst >= 10) {
          let maxPillar: PolicyPillarKey | null = null;
          let maxValue = 0;
          for (const [pillar, value] of Object.entries(game.pillarTallies)) {
            if (value > maxValue) {
              maxValue = value;
              maxPillar = pillar as PolicyPillarKey;
            }
          }
          if (maxPillar) {
            nextActiveMandate = maxPillar;
            electionHeadline = `Election won by a MASSIVE MARGIN. You secured a mandate: ${MANDATES[maxPillar].name}`;
          }
        } else {
          electionHeadline = `No-confidence vote survived (${noConfidence.votesFor}-${noConfidence.votesAgainst}).`;
        }

        // Reset tallies at the end of the term
        nextPillarTallies = {
          social_safety_net: 0,
          green_stewardship: 0,
          global_diplomacy: 0,
          hardline_nationalism: 0,
          market_growth: 0,
          identity_equity: 0,
          labor_power: 0,
          fiscal_restraint: 0,
          national_security: 0,
          traditional_values: 0,
        };
      }

      if (nextTurn >= FULL_TERM_TURNS && !game.endlessMode) {
        setGame(prev => ({
          ...prev,
          stats: nextStats,
          hiddenStats: nextHiddenStats,
          regionLoyalty: nextRegionLoyalty,
          activeMandate: nextActiveMandate ?? game.activeMandate,
          pillarTallies: nextPillarTallies ?? resolution.next.pillarTallies,
          turn: nextTurn,
          deck: prev.deck, // Don't advance card yet, wait for finale choice
          currentCardId: prev.currentCardId,
          showFinaleChoice: true,
          headline: 'Full term completed. A choice awaits.',
        }));
        setPreviewDirection(null);
        return;
      }

      const nextSelection = selectNextCard(game.deck, advisorBias, nextHiddenStats, drawRng, resolution.next.flags, selectedAdvisor?.id ?? null, nextStats.sustainability === 100, game.endlessMode ? Math.max(0, nextTurn - FULL_TERM_TURNS) : 0);

      if (drawDebugEnabled) {
        // eslint-disable-next-line no-console
        console.debug('[draw]', {
          turn: nextTurn,
          cardId: nextSelection.cardId,
          remainingCards: nextSelection.deck.length,
        });
      }

      if (!nextSelection.cardId) {
        const endingSummary = getEndingSummary({
          reason: 'completed',
          stats: nextStats,
          hiddenStats: nextHiddenStats,
          turn: nextTurn,
        });

        setGame({
          ...game,
          stats: nextStats,
          hiddenStats: nextHiddenStats,
          regionLoyalty: nextRegionLoyalty,
          flags: resolution.next.flags,
          activeMandate: nextActiveMandate ?? null,
          pillarTallies: nextPillarTallies ?? resolution.next.pillarTallies,
          turn: nextTurn,
          deck: nextSelection.deck,
          currentCardId: null,
          headline: 'No more cards. Administration concluded.',
          endingSummary,
          gameOver: true,
          gameOverReason: 'completed',
        });
        setPreviewDirection(null);
        return;
      }

      const headline = [electionHeadline, outcomeHint].filter((part) => Boolean(part)).join(' ');


      // Capital Passive: +10 to other 3 core metrics every 5 turns if Capital is 100
      if (nextStats.capital === 100 && nextTurn % 5 === 0) {
        // We use the same applyChoiceToStats logic to ensure overflow goes to buffers
        const passiveEffects = { authority: 10, sentiment: 10, sustainability: 10 };
        const passiveResult = applyChoiceToStats(nextStats, nextBuffers, { effects: passiveEffects } as any, nextActiveMandate);
        nextStats = passiveResult.stats;
        // The result of applyChoiceToStats also updates nextBuffers via reference or return?
        // Wait, applyChoiceToStats returns { stats, statBuffers }.
        // My previous code ignored the buffer update. I should fix that.
      }

      // Mandate Passives
      if (nextActiveMandate === 'global_diplomacy') {
        // Peace Mandate: +5 Capital and +5 Sentiment each turn
        const peaceEffects = { capital: 5, sentiment: 5 };
        const peaceResult = applyChoiceToStats(nextStats, nextBuffers, { effects: peaceEffects } as any, nextActiveMandate);
        nextStats = peaceResult.stats;
        Object.assign(nextBuffers, peaceResult.statBuffers);
      } else if (nextActiveMandate === 'hardline_nationalism') {
        // Nationalist Mandate: +5 Authority each turn
        const nationalistEffects = { authority: 5 };
        const nationalistResult = applyChoiceToStats(nextStats, nextBuffers, { effects: nationalistEffects } as any, nextActiveMandate);
        nextStats = nationalistResult.stats;
        Object.assign(nextBuffers, nationalistResult.statBuffers);
        // And +10 static regional loyalty to all regions
        for (const region of REGION_KEYS) {
          nextRegionLoyalty[region] = Math.min(100, nextRegionLoyalty[region] + 10);
        }
      } else if (nextActiveMandate === 'traditional_values') {
        // Heritage Mandate: +25 static regional loyalty
        for (const region of REGION_KEYS) {
          nextRegionLoyalty[region] = Math.min(100, nextRegionLoyalty[region] + 25);
        }
      }

      setGame({
        ...game,
        stats: nextStats,
        statBuffers: nextBuffers,
        hiddenStats: nextHiddenStats,
        regionLoyalty: nextRegionLoyalty,
        flags: resolution.next.flags,
        activeMandate: nextActiveMandate ?? null,
        pillarTallies: nextPillarTallies ?? resolution.next.pillarTallies,
        turn: nextTurn,
        deck: nextSelection.deck,
        currentCardId: nextSelection.cardId,
        headline: headline || null,
        malikCooldown: nextMalikCooldown,
        malikRewriteActive: false,
        unlockedDirection: null, // Clear unlock state on card swipe
        activeUnlock: null, // Clear active unlock state on card swipe
      });

      setPreviewDirection(null);
    },
    [advisorBias, currentCard, drawDebugEnabled, drawRng, game, resolutionDebugEnabled, leftBlocked, rightBlocked],
  );

  useEffect(() => {
    saveGameState(game);
  }, [game]);

  useEffect(() => {
    if (game.gameOver || currentCard || game.showFinaleChoice) {
      return;
    }

    setGame((current) => {
      if (current.gameOver || current.currentCardId || current.showFinaleChoice) {
        return current;
      }

      const currentAdvisor =
        current.advisorId && isAdvisorId(current.advisorId) ? getAdvisorById(current.advisorId) : null;
      const nextSelection = selectNextCard(current.deck, currentAdvisor?.bias, current.hiddenStats, drawRng, current.flags, current.advisorId, current.stats.sustainability === 100, current.endlessMode ? Math.max(0, current.turn - FULL_TERM_TURNS) : 0);

      if (!nextSelection.cardId) {
        const endingSummary = getEndingSummary({
          reason: 'completed',
          stats: current.stats,
          hiddenStats: current.hiddenStats,
          turn: current.turn,
        });

        return {
          ...current,
          gameOver: true,
          gameOverReason: 'completed',
          headline: current.headline ?? 'No more cards available.',
          endingSummary,
        };
      }

      return {
        ...current,
        deck: nextSelection.deck,
        currentCardId: nextSelection.cardId,
        headline: current.headline ?? 'Recovered decision flow from an outdated save.',
      };
    });
  }, [currentCard, drawRng, game.gameOver, game.showFinaleChoice]);

  useEffect(() => {
    if (!game.headline || game.gameOver) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setGame((current) => (current.headline ? { ...current, headline: null } : current));
    }, HEADLINE_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [game.gameOver, game.headline]);

  const dismissIntro = useCallback(() => {
    try { window.sessionStorage.setItem('fra-intro-seen', '1'); } catch { /* ignore */ }
    clearGameState();
    setGame(createNewGameState(null));
    setShowIntro(false);
  }, []);

  if (showIntro) {
    return (
      <div className="intro-screen">
        <div className="intro-panel" style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}>
          <h1 className="intro-title glow-amber" style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: 'none' }}>
            FEDERAL REPUBLIC OF AMERICA
          </h1>

          <div className="intro-section" style={{ border: 'none', background: 'transparent', padding: '0 1rem', marginBottom: '2rem', textAlign: 'center' }}>
            <p className="intro-body" style={{ fontStyle: 'italic', lineHeight: '1.8', fontSize: '1.05rem', marginBottom: '1.5rem' }}>
              You are the newly appointed Chancellor. Fourteen regional governors are watching. The nation's stability rests on four critical pillars: Authority, Capital, Sentiment, and Sustainability. Let any of them collapse, and your administration falls.
            </p>
            <p className="intro-body" style={{ fontStyle: 'italic', lineHeight: '1.8', fontSize: '1.05rem' }}>
              Every 25 decisions, the governors will hold a Vote of No Confidence. Complete 3 full terms to secure your legacy. Choose your advisors and policies wisely.
            </p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p className="intro-body" style={{ opacity: 0.7 }}>
              [ DRAG CARDS LEFT/RIGHT OR USE ARROWS TO GOVERN ]
            </p>
          </div>

          <button
            className="advisor-action-btn intro-start-btn"
            type="button"
            onClick={dismissIntro}
          >
            [ PROCEED TO ADVISOR SELECTION ]
          </button>

          <footer className="credits-footnote">
            <a href="https://github.com/quehorrifico/federal-republic-of-america" target="_blank" rel="noopener noreferrer">
              [ SOURCE CODE / REPOSITORY | v2.0.1 ]
            </a>
          </footer>
        </div>
      </div>
    );
  }

  if (needsAdvisorSelection) {
    return (
      <div className="intro-screen">
        <div className="intro-panel" style={{ maxWidth: '1200px', width: '95%', paddingTop: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
          <h1 className="intro-title glow-amber" style={{ textAlign: 'center', marginBottom: '0.5rem', borderBottom: 'none' }}>
            ADVISOR SYSTEM
          </h1>
          <p className="intro-body" style={{ textAlign: 'center', marginBottom: '2rem', fontStyle: 'italic', opacity: 0.8 }}>
            Select an advisor to guide your administration. Their unique passive biases and active protocols will shape your legacy.
          </p>
          <div className="responsive-grid" style={{ gap: '1.5rem' }}>
            {ADVISOR_LIST.map((advisor) => (
              <button
                key={advisor.id}
                type="button"
                className="advisor-action-btn"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', padding: '1.2rem' }}
                onClick={() => selectAdvisor(advisor.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{advisor.name.replace(/\s*\([^)]+\)/g, '').toUpperCase()}</span>
                  <span className="glow-amber" style={{ fontSize: '0.8rem' }}>[{advisor.id.toUpperCase()}]</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                  "{advisor.pitch}"
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '0.5rem' }}>
                  <span className="glow-green" style={{ whiteSpace: 'pre-line' }}>{advisor.benefit}</span>
                  <span className="glow-red" style={{ whiteSpace: 'pre-line' }}>{advisor.drawback}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showIntro) {
    return (
      <main className="main-layout" role="main">
        <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Welcome">
          <div className="settings-modal-panel game-over-panel" style={{ maxWidth: '600px', cursor: 'grab' }}>
            <h2 className="glow-amber" style={{ fontSize: '1.5rem', marginBottom: '1rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>[ INITIALIZING: PROJECT FRA ]</h2>
            <p style={{ marginBottom: '1rem', lineHeight: '1.4' }}>
              Welcome to the <span className="glow-amber">Federal Republic of America</span> administration terminal.
            </p>
            <p style={{ marginBottom: '1rem', lineHeight: '1.4' }}>
              You are the Chief Executive. Your mandate is to maintain the delicate balance of the Federal Government by managing four core metrics: <b>Authority</b>, <b>Capital</b>, <b>Sentiment</b>, and <b>Sustainability</b>. Keep them from reaching absolute zero, or the Republic will collapse.
            </p>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li><b>Term 1 (Idealism):</b> Balance regional needs. Establish an Advisor.</li>
                <li><b>Term 2 (Gridlock):</b> Coalitions form when multiple governors grow hostile under neglected hidden metrics. They will bloc-vote to pad lock your choices.</li>
                <li><b>Term 3 (Pragmatism):</b> Desperation unlocks the ability to use Federal Capital as a Bribe to force through blocked policies. Beware of letting your Corruption reach 100.</li>
              </ul>
            </div>
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Survive 75 turns (3 full legislative terms) to secure your legacy. Will you step down gracefully? Or suspend the elections and rule indefinitely as the crises mount?
            </p>

            <button
              className="advisor-action-btn"
              type="button"
              onClick={() => {
                setShowIntro(false);
                try { window.sessionStorage.setItem('fra-intro-seen', '1'); } catch { /* ignore */ }
              }}
              style={{ padding: '0.75rem' }}
            >
              [ ACKNOWLEDGE & COMMENCE ]
            </button>
          </div>
        </section>
      </main>
    );
  }

  const finaleUi = game.showFinaleChoice ? (
    <section className="settings-modal" role="dialog" aria-modal="true" aria-label="End of Term">
      <div className="settings-modal-panel game-over-panel" style={{ maxWidth: '600px' }}>
        <h2 className="glow-green" style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginTop: 0 }}>[ TERM COMPLETION ]</h2>
        <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
          You have reached the end of your 3-Term mandate (Turn 75). Order is restored, for now.
        </p>
        <div style={{ border: '1px solid var(--border-color)', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
          {getEndingSummary({
            reason: 'completed',
            stats: game.stats,
            hiddenStats: game.hiddenStats,
            turn: game.turn,
          }).split('\n').map((line, i) => <p key={i} style={{ marginBottom: line.trim() ? '0.5rem' : '0' }}>{line}</p>)}
        </div>
        <div className="responsive-grid" style={{ gap: '1rem', marginTop: '2rem' }}>
          <button
            className="advisor-action-btn"
            type="button"
            onClick={() => {
              setGame(prev => ({
                ...prev,
                showFinaleChoice: false,
                gameOver: true,
                gameOverReason: 'completed',
                headline: 'Mandate complete. The regional governors stand down.',
                endingSummary: getEndingSummary({
                  reason: 'completed',
                  stats: prev.stats,
                  hiddenStats: prev.hiddenStats,
                  turn: prev.turn,
                }),
              }));
            }}
          >
            [ STEP DOWN / SOLIDIFY LEGACY ]
          </button>
          <button
            className="advisor-action-btn gov-status-revolt"
            style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
            type="button"
            onClick={() => {
              setGame(prev => ({
                ...prev,
                showFinaleChoice: false,
                endlessMode: true,
                headline: '[ ELECTIONS SUSPENDED. EXECUTIVE CONTROL INDEFINITE. ]',
              }));
            }}
          >
            [ SUSPEND ELECTIONS / ENDLESS ]
          </button>
        </div>
      </div>
    </section>
  ) : null;

  if (game.gameOver) {
    return (
      <>
        <GameOver
          reason={game.gameOverReason}
          turns={game.turn}
          endingSummary={game.endingSummary}
          onRestart={startNewGame}
        />
        {electionModalUi}
      </>
    );
  }

  return (
    <div className="app-shell">
      <main className="game-layout">
        <header className="top-strip">
          <StatsBar
            stats={game.stats}
            statBuffers={game.statBuffers}
            previewStats={previewState?.stats}
            previewStatBuffers={previewState?.buffers}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end', fontSize: '0.8rem' }}>
            <button className="settings-btn" type="button" onClick={() => setSettingsOpen(true)}>
              [ SYSTEM.SETTINGS ]
            </button>
            <div className="glow-amber">TERM {currentTerm}/3 | NEXT ELECTION IN {turnsUntilElection}</div>
          </div>
        </header>

        <aside className="gov-sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', marginBottom: '1rem', paddingBottom: '0.2rem' }}>
            <h2 style={{ border: 'none', margin: 0 }}>REGIONAL GOVERNORS</h2>
            <button
              className="settings-btn"
              style={{ fontSize: '0.7rem' }}
              onClick={() => setGovSortMode(current => current === 'default' ? 'loyalty' : 'default')}
            >
              [ SORT: {govSortMode === 'default' ? 'ORIG' : 'LOYALTY'} ]
            </button>
          </div>
          <ul className="gov-list">
            {(() => {
              const renderGovernorItem = (region: RegionKey) => {
                const governor = GOVERNORS[region];
                let loyalty = game.regionLoyalty[region] ?? 0;

                if (game.stats.sentiment === 100) {
                  loyalty = Math.min(100, loyalty + 10);
                }

                const isPacified = game.pacifiedRegions.includes(region);
                const state = isPacified ? 'pacified' : getRegionLoyaltyState(loyalty);
                let statusClass = 'gov-status-neutral';
                if (isPacified) statusClass = 'gov-status-pacified';
                else if (state === 'loyalist' || state === 'supportive') statusClass = 'gov-status-loyal';
                if (state === 'revolt' || state === 'angry') statusClass = 'gov-status-revolt';

                return (
                  <li key={region} className="gov-item">
                    <span>{governor.futureRegionName.toUpperCase()}</span>
                    <span className={statusClass}>[{state.toUpperCase()}]</span>
                  </li>
                );
              };

              if (coalitionGovernors.length > 0) {
                const coalition = sortedRegions.filter(r => coalitionGovernors.includes(r));
                const others = sortedRegions.filter(r => !coalitionGovernors.includes(r));

                return (
                  <>
                    <li className="coalition-box">
                      <div className="gov-status-revolt" style={{ fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        [ COALITION BLOC: {activeCoalitions.map(s => s.replace(/_/g, ' ')).join(', ').toUpperCase()} ]
                      </div>
                      <ul className="gov-list">
                        {coalition.map(renderGovernorItem)}
                      </ul>
                    </li>
                    {others.map(renderGovernorItem)}
                  </>
                );
              }

              return sortedRegions.map(renderGovernorItem);
            })()}
          </ul>
        </aside>

        <section className="action-stage">
          {currentCard ? (
            <DecisionCard
              key={currentCard.id}
              card={currentCard}
              disabled={!!electionModal || settingsOpen || needsAdvisorSelection}
              malikRewriteActive={game.malikRewriteActive}
              isPacified={Boolean(currentCard.governor && game.pacifiedRegions.includes(currentCard.governor))}
              isDataBroker={selectedAdvisor?.id === 'data_broker'}
              leftBlocked={leftBlocked}
              rightBlocked={rightBlocked}
              unlockedDirection={game.unlockedDirection}
              activeUnlock={game.activeUnlock}
              onBribe={handleBribe}
              onForce={handleForce}
              canBribe={canBribe}
              canForce={canForce}
              onChoose={onChoose}
              onPreviewDirection={setPreviewDirection}
            />
          ) : (
            <div className="fallback-card glow-amber">NO PENDING DECISIONS.</div>
          )}

          <AdvisorAction
            advisorId={selectedAdvisor?.id ?? null}
            capitalStat={game.stats.capital}
            malikCooldown={game.malikCooldown}
            krossAvailable={
              game.krossLastUsedElectionTerm === null ||
              game.krossLastUsedElectionTerm < Math.floor(game.turn / ELECTION_INTERVAL)
            }
            santanaAvailable={game.santanaLastUsedTurn !== game.turn}
            martialLawActive={game.martialLawActive}
            isCardRegion={Boolean(currentCard?.governor)}
            onAction={onAdvisorAction}
          />

          {/* 
            FUTURE FEATURE: Authority Passive (Executive Buffer)
            If Authority is 100 and a Coalition Card is presented, 
            display 'BYPASS COALITION' button here. 
            This button would cost Authority Buffer instead of relying on corruption.
          */}
        </section>

        <aside className="status-sidebar">
          <div style={{ borderBottom: '1px dashed var(--border-color)', marginBottom: '1rem', paddingBottom: '0.2rem' }}>
            <h2 style={{ border: 'none', margin: 0 }}>STATUS PANEL</h2>
          </div>
          <ul className="status-list">

            {/* MANDATE TOOLTIP */}
            {game.activeMandate && (
              <li className="status-item" style={{ borderColor: 'var(--text-main)' }}>
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick(MANDATES[game.activeMandate!].name, MANDATES[game.activeMandate!].description, 'glow-amber')}>
                  <span className="status-name glow-amber">{MANDATES[game.activeMandate].name}</span>
                  <div className="tooltip-box glow-amber">
                    <div className="tooltip-title">{MANDATES[game.activeMandate].name}</div>
                    <div className="tooltip-body">{MANDATES[game.activeMandate].description}</div>
                  </div>
                </div>
              </li>
            )}

            {/* ADVISOR TOOLTIP */}
            {selectedAdvisor && (
              <li className="status-item" style={{ borderColor: 'var(--text-main)' }}>
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick(selectedAdvisor.name, selectedAdvisor.benefit, 'glow-amber')}>
                  <span className="status-name glow-amber">Advisor: {selectedAdvisor.name}</span>
                  <div className="tooltip-box glow-amber">
                    <div className="tooltip-title">{selectedAdvisor.name}</div>
                    <div className="tooltip-body">{selectedAdvisor.benefit}</div>
                  </div>
                </div>
              </li>
            )}

            {/* COALITIONS TOOLTIP */}
            {activeCoalitions.length > 0 && (
              <li className="status-item" style={{ borderColor: '#ff003c' }}>
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick('Coalition Block', 'A synchronized voting bloc has formed among dissenting governors. They cannot be bribed individually—you must force or bribe the entire bloc simultaneously.', 'gov-status-revolt')}>
                  <span className="status-name gov-status-revolt">ACTIVE COALITION</span>
                  <div className="tooltip-box gov-status-revolt">
                    <div className="tooltip-title">Coalition Block</div>
                    <div className="tooltip-body">A synchronized voting bloc has formed among dissenting governors. They cannot be bribed individually—you must force or bribe the entire bloc simultaneously.</div>
                  </div>
                </div>
              </li>
            )}

            {/* BUFFER TOOLTIPS */}
            {game.stats.capital === 100 && (
              <li className="status-item">
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick('Capital Overflow', 'Peak financial strength. Extra capital becomes buffer points. Every 5 turns, other core stats gain +10.', 'glow-green')}>
                  <span className="status-name">Capital Overflow</span>
                  <div className="tooltip-box glow-green">
                    <div className="tooltip-title">Capital Overflow</div>
                    <div className="tooltip-body">Peak financial strength. Extra capital becomes buffer points. Every 5 turns, other core stats gain +10.</div>
                  </div>
                </div>
              </li>
            )}
            {game.stats.sentiment === 100 && (
              <li className="status-item">
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick('Sentiment Overflow', 'Peak public support. Extra sentiment becomes buffer points. All governors gain +10 loyalty.', 'glow-green')}>
                  <span className="status-name">Sentiment Overflow</span>
                  <div className="tooltip-box glow-green">
                    <div className="tooltip-title">Sentiment Overflow</div>
                    <div className="tooltip-body">Peak public support. Extra sentiment becomes buffer points. All governors gain +10 loyalty.</div>
                  </div>
                </div>
              </li>
            )}
            {game.stats.authority === 100 && (
              <li className="status-item">
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick('Authority Overflow', 'Peak executive power. Extra authority becomes buffer points. Coalition blocks can be bypassed by spending Authority Buffer.', 'glow-green')}>
                  <span className="status-name">Authority Overflow</span>
                  <div className="tooltip-box glow-green">
                    <div className="tooltip-title">Authority Overflow</div>
                    <div className="tooltip-body">Peak executive power. Extra authority becomes buffer points. Coalition blocks can be bypassed by spending Authority Buffer.</div>
                  </div>
                </div>
              </li>
            )}
            {game.stats.sustainability === 100 && (
              <li className="status-item">
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick('Sustainability Overflow', 'Peak ecological balance. Extra sustainability becomes buffer points. The probability of drawing Crisis cards is halved.', 'glow-green')}>
                  <span className="status-name">Sustainability Overflow</span>
                  <div className="tooltip-box glow-green">
                    <div className="tooltip-title">Sustainability Overflow</div>
                    <div className="tooltip-body">Peak ecological balance. Extra sustainability becomes buffer points. The probability of drawing Crisis cards is halved.</div>
                  </div>
                </div>
              </li>
            )}

            {/* CORRUPTION TOOLTIP */}
            {game.corruption > 0 && (
              <li className="status-item" style={{ marginTop: '1.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', borderColor: '#ff003c' }}>
                <div className="tooltip-container" onClick={() => handleMobileTooltipClick('Corruption Threat', 'Bribes to bypass coalition blocks erode public trust. Impeachment triggers inherently at 100%.', 'gov-status-revolt')}>
                  <span className="status-name gov-status-revolt" style={{ fontSize: '1.1rem' }}>CORRUPTION: {game.corruption}%</span>
                  <div className="tooltip-box gov-status-revolt">
                    <div className="tooltip-title">Corruption Threat</div>
                    <div className="tooltip-body">Bribes to bypass coalition blocks erode public trust. Impeachment triggers inherently at 100%.</div>
                  </div>
                </div>
                <div style={{ width: '100%', height: '18px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', position: 'relative', marginTop: '0.5rem' }}>
                  <div style={{ width: `${game.corruption}%`, height: '100%', backgroundColor: 'var(--text-alert)' }}></div>
                </div>
              </li>
            )}

            {!game.activeMandate && !selectedAdvisor && activeCoalitions.length === 0 && Object.values(game.stats).every(v => v < 100) && (
              <li style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                NO SYSTEM PASSIVES ACTIVE
              </li>
            )}



          </ul>
        </aside>

        {activeMobileTooltip ? (
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Tooltip Details" onClick={() => setActiveMobileTooltip(null)}>
            <div className={`settings-modal-panel tooltip-box-mobile ${activeMobileTooltip.cssClass}`} style={{ textAlign: 'center', pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>
              <h2 className={activeMobileTooltip.cssClass} style={{ borderBottom: '1px dashed currentColor', paddingBottom: '0.5rem', marginTop: 0 }}>{activeMobileTooltip.title.toUpperCase()}</h2>
              <div style={{ fontSize: '1rem', marginBottom: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {activeMobileTooltip.body}
              </div>
              <button
                className={`advisor-action-btn ${activeMobileTooltip.cssClass}`}
                style={{ width: '100%', borderColor: 'currentColor', boxShadow: 'none' }}
                type="button"
                onClick={() => setActiveMobileTooltip(null)}
              >
                [ DISMISS ]
              </button>
            </div>
          </section>
        ) : null}

        {settingsOpen ? (
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Game settings">
            <div className="settings-modal-panel">
              <h2 className="glow-amber" style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginTop: 0 }}>[ SYSTEM.SETTINGS ]</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                Initiate a new administration. Warning: all current progress will be cleared and control will return to advisor selection.
              </p>
              <div className="settings-actions" style={{ gap: '1rem' }}>
                <button className="advisor-action-btn" style={{ flex: 1, color: '#ff003c', borderColor: '#ff003c', boxShadow: 'inset 0 0 10px rgba(255,0,60,0.2), 0 0 10px rgba(255,0,60,0.2)' }} type="button" onClick={startNewGame}>
                  [ WIPE &amp; RESTART ]
                </button>
                <button className="advisor-action-btn" type="button" onClick={() => setSettingsOpen(false)}>
                  [ CANCEL ]
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {advisorInfoOpen && selectedAdvisor && (
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Advisor Information">
            <div className="settings-modal-panel" style={{ maxWidth: '680px' }}>
              <div className="intro-header">
                <span className="glow-amber" style={{ fontSize: '0.85rem', letterSpacing: '0.15em' }}>FEDERAL REPUBLIC OF AMERICA — INTEL DOSSIER</span>
              </div>
              <h1 className="intro-title glow-amber" style={{ fontSize: '1.5rem', marginTop: '1rem' }}>
                {selectedAdvisor.name.toUpperCase()}
              </h1>

              <div className="intro-section" style={{ marginTop: '1rem' }}>
                <p className="intro-section-header glow-green">&gt; PROFILE PREVIEW</p>
                <p className="intro-body" style={{ fontStyle: 'italic' }}>"{selectedAdvisor.pitch}"</p>
              </div>

              <div className="intro-section">
                <p className="intro-section-header glow-green">&gt; ACTIVE / PASSIVE PROTOCOLS</p>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <span className="glow-green" style={{ whiteSpace: 'pre-line' }}>{selectedAdvisor.benefit}</span>
                  <span className="glow-amber" style={{ whiteSpace: 'pre-line' }}>{selectedAdvisor.drawback}</span>
                </div>
              </div>

              <div className="settings-actions">
                <button className="advisor-action-btn" type="button" onClick={() => setAdvisorInfoOpen(false)}>
                  [ DISMISS DOSSIER ]
                </button>
              </div>
            </div>
          </section>
        )}

        {finaleUi}
        {electionModalUi}
      </main>
    </div>
  );
}

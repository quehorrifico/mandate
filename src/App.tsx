import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdvisorAction } from './components/AdvisorAction';
import { DecisionCard } from './components/DecisionCard';
import { GameOver } from './components/GameOver';
import { StatsBar } from './components/StatsBar';
import { ADVISOR_LIST, getAdvisorById } from './data/advisors';
import cardsData from './data/cards.json';
import { GOVERNORS } from './data/governors';
import {
  applyDeckSelection,
  createSeededRng,
  inferCardType,
  selectPolicyCardFromDeck,
} from './lib/cardSelection';
import {
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
  type AdvisorId,
  type AdvisorSelectionBias,
  type Card,
  type Direction,
  type GameOverReason,
  type GameState,
  type HiddenStats,
  type HiddenStatKey,
  type RawCard,
  type RegionLoyaltyByRegion,
  type StatKey,
  type Stats,
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

const POLICY_CARD_BY_ID = new Map(ALL_POLICY_CARDS.map((card) => [card.id, card]));

const INITIAL_STATS: Stats = {
  authority: 80,
  capital: 80,
  sentiment: 80,
  sustainability: 30,
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
  rng: () => number,
): { deck: string[]; cardId: string | null } {
  if (deck.length === 0) {
    return { deck, cardId: null };
  }

  const selected = selectPolicyCardFromDeck({
    deck,
    advisorBias,
    cardsById: POLICY_CARD_BY_ID,
    rng,
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
  const firstSelection = selectNextCard(deck, advisor?.bias, Math.random);

  return {
    advisorId,
    stats: { ...INITIAL_STATS },
    hiddenStats: { ...INITIAL_HIDDEN_STATS },
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
        .map((change) => `${getStatHintLabel(change.key)} ${formatSigned(change.delta)}`)
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

function getNoConfidenceResult(turn: number, regionLoyalty: RegionLoyaltyByRegion, threshold: number): ElectionResult {
  const forVotes: ElectionVote[] = [];
  const againstVotes: ElectionVote[] = [];
  for (const region of REGION_KEYS) {
    const loyalty = regionLoyalty[region] ?? 0;
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
  const previewStats = useMemo(() => {
    if (!previewDirection || !currentCard || game.gameOver) {
      return undefined;
    }

    const resolution = resolveCardDecision({
      state: {
        stats: game.stats,
        hiddenStats: game.hiddenStats,
        regionLoyalty: game.regionLoyalty,
        malikRewriteActive: game.malikRewriteActive,
        pacifiedRegions: game.pacifiedRegions,
      },
      card: currentCard,
      direction: previewDirection,
    });

    const nextStats = { ...resolution.next.stats };

    if (game.martialLawActive) {
      // Ignore card effects for these 3 metrics, use current game stats minus protocol drain
      nextStats.authority = 100;
      nextStats.capital = Math.max(0, game.stats.capital - 10);
      nextStats.sentiment = Math.max(0, game.stats.sentiment - 10);
      // nextStats.sustainability is already set from resolution.next.stats and remains subject to card choice
    }

    return nextStats;
  }, [currentCard, game.gameOver, game.stats, game.hiddenStats, game.regionLoyalty, game.malikRewriteActive, game.martialLawActive, previewDirection]);

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem', marginBottom: '2rem' }}>
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
      if (game.stats.capital > 10) return;

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

      const resolution = resolveCardDecision({
        state: {
          stats: game.stats,
          hiddenStats: game.hiddenStats,
          regionLoyalty: game.regionLoyalty,
          malikRewriteActive: game.malikRewriteActive,
          pacifiedRegions: game.pacifiedRegions,
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

      let nextStats = resolution.next.stats;
      const nextHiddenStats = { ...resolution.next.hiddenStats };
      const nextRegionLoyalty = { ...resolution.next.regionLoyalty };

      if (game.martialLawActive) {
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

      let electionHeadline: string | null = null;
      if (nextTurn % ELECTION_INTERVAL === 0 && nextTurn < FULL_TERM_TURNS) {
        const threshold = selectedAdvisor?.id === 'data_broker' ? 9 : ELECTION_MAJORITY;
        const noConfidence = getNoConfidenceResult(nextTurn, nextRegionLoyalty, threshold);
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

        electionHeadline = `No-confidence vote survived (${noConfidence.votesFor}-${noConfidence.votesAgainst}).`;
      }

      if (nextTurn >= FULL_TERM_TURNS) {
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
          turn: nextTurn,
          currentCardId: null,
          headline: 'Full term completed.',
          endingSummary,
          gameOver: true,
          gameOverReason: 'completed',
        });
        setPreviewDirection(null);
        return;
      }

      const nextSelection = selectNextCard(game.deck, advisorBias, drawRng);

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

      setGame({
        advisorId: game.advisorId,
        stats: nextStats,
        hiddenStats: nextHiddenStats,
        regionLoyalty: nextRegionLoyalty,
        turn: nextTurn,
        deck: nextSelection.deck,
        currentCardId: nextSelection.cardId,
        headline: headline || null,
        endingSummary: null,
        gameOver: false,
        gameOverReason: null,
        malikCooldown: nextMalikCooldown,
        malikRewriteActive: false, // reset on next card
        krossLastUsedElectionTerm: game.krossLastUsedElectionTerm,
        santanaLastUsedElectionTerm: game.santanaLastUsedElectionTerm,
        santanaLastUsedTurn: game.santanaLastUsedTurn,
        martialLawActive: game.martialLawActive,
        pacifiedRegions: game.pacifiedRegions,
      });

      setPreviewDirection(null);
    },
    [advisorBias, currentCard, drawDebugEnabled, drawRng, game, resolutionDebugEnabled],
  );

  useEffect(() => {
    saveGameState(game);
  }, [game]);

  useEffect(() => {
    if (game.gameOver || currentCard) {
      return;
    }

    setGame((current) => {
      if (current.gameOver || current.currentCardId) {
        return current;
      }

      const currentAdvisor =
        current.advisorId && isAdvisorId(current.advisorId) ? getAdvisorById(current.advisorId) : null;
      const nextSelection = selectNextCard(current.deck, currentAdvisor?.bias, drawRng);

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
  }, [currentCard, drawRng, game.gameOver]);

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
        <div className="intro-panel">
          <div className="intro-header">
            <span className="glow-amber" style={{ fontSize: '0.85rem', letterSpacing: '0.15em' }}>FEDERAL REPUBLIC OF AMERICA — EXECUTIVE TERMINAL v1.0</span>
          </div>

          <h1 className="intro-title glow-amber">CHANCELLOR'S<br />BRIEFING ROOM</h1>

          <div className="intro-section">
            <p className="intro-section-header glow-green">&gt; SITUATION REPORT</p>
            <p className="intro-body">You are the newly appointed Chancellor of the Federal Republic. Fourteen regional governors are watching. The nation's stability rests on four critical systems: <strong>Authority</strong>, <strong>Capital</strong>, <strong>Sentiment</strong>, and <strong>Sustainability</strong>. Let any of them collapse to zero — and so does your administration.</p>
          </div>

          <div className="intro-section">
            <p className="intro-section-header glow-green">&gt; THE FOUR PILLARS</p>
            <p className="intro-body"><strong>Authority</strong> — The state's grip on its institutions. Erodes when the government is defied, destabilized, or overruled.</p>
            <p className="intro-body"><strong>Capital</strong> — Federal treasury reserves. Funds operations, buyouts, and crisis response. Runs dry faster than you'd expect. Only metric which can have a deficit.</p>
            <p className="intro-body"><strong>Sentiment</strong> — Public approval of the administration. Shaped by how proposals land with the population. Low sentiment makes governors restless.</p>
            <p className="intro-body"><strong>Sustainability</strong> — Long-term systemic viability. Industrial, environmental, and infrastructural pressure accumulates quietly.</p>
          </div>

          <div className="intro-section">
            <p className="intro-section-header glow-green">&gt; REGIONAL COMMAND</p>
            <p className="intro-body">Each of the 14 governors operates independently. Their loyalty to the administration shifts based on the decisions you make. A <span className="glow-green">loyalist</span> or neutral governor votes for you in elections. An <span className="gov-status-revolt">angry or revolting</span> governor votes against you.</p>
            <p className="intro-body">Some proposals target a specific governor's region directly. Choose carefully — what placates one region may inflame another.</p>
          </div>

          <div className="intro-section">
            <p className="intro-section-header glow-green">&gt; THREAT ASSESSMENT</p>
            <p className="intro-body">Every 25 turns, governors hold a <strong>Vote of No Confidence</strong>. Survive it or the administration falls. Regional governors each have a loyalty rating. Let too many revolt and elections become impossible to win. Your administration lasts <strong>3 turns</strong>. Complete 3 full terms to win.</p>
          </div>

          <div className="intro-section">
            <p className="intro-section-header glow-green">&gt; OPERATIONAL MECHANICS</p>
            <p className="intro-body">[DRAG RIGHT] — Approve the proposal. Endorse it.</p>
            <p className="intro-body">[DRAG LEFT] — Reject the proposal. Deny it.</p>
            <p className="intro-body">[ARROW KEYS] — Keyboard override available.</p>
          </div>

          <div className="intro-section">
            <p className="intro-section-header glow-green">&gt; ADVISOR SYSTEM</p>
            <p className="intro-body">You will be assigned an advisor before play begins. Each advisor has a <strong>passive protocol</strong> that shapes the types of proposals you receive. Some carry an <strong>active protocol</strong> that grants emergency executive capabilities, with postive and negative game-changing effects.</p>
            <p className="intro-body">Choose wisely. Your advisor is not a neutral party. They have an agenda, and it will shape the Federal Republic's future as much as your own decisions do.</p>
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
              [ SOURCE CODE / REPOSITORY ]
            </a>
          </footer>
        </div>
      </div>
    );
  }

  if (needsAdvisorSelection) {
    return (
      <div className="intro-screen">
        <div className="intro-panel" style={{ maxWidth: '680px' }}>
          <div className="intro-header">
            <span className="glow-amber" style={{ fontSize: '0.85rem', letterSpacing: '0.15em' }}>FEDERAL REPUBLIC OF AMERICA — EXECUTIVE TERMINAL v1.0</span>
          </div>
          <h1 className="intro-title glow-amber" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>[ INITIALIZE ADVISOR SYSTEM ]</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                  <span className="glow-green" style={{ fontSize: '0.8rem' }}>[{advisor.id.toUpperCase()}]</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                  "{advisor.pitch}"
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '0.5rem' }}>
                  <span className="glow-green" style={{ whiteSpace: 'pre-line' }}>{advisor.benefit}</span>
                  <span className="glow-amber" style={{ whiteSpace: 'pre-line' }}>{advisor.drawback}</span>
                </div>
              </button>
            ))}
          </div>

          <footer className="credits-footnote">
            <a href="https://github.com/quehorrifico/federal-republic-of-america" target="_blank" rel="noopener noreferrer">
              [ SOURCE CODE / REPOSITORY ]
            </a>
          </footer>
        </div>
      </div>
    );
  }

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
          <StatsBar stats={game.stats} previewStats={previewStats} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end', fontSize: '0.8rem' }}>
            <button 
              className="settings-btn advisor-top-btn" 
              onClick={() => setAdvisorInfoOpen(true)}
            >
              ADVISOR: {selectedAdvisor ? selectedAdvisor.name.toUpperCase() : 'UNASSIGNED'}
            </button>
            <div className="glow-green">TERM {currentTerm}/3 | NEXT ELECTION IN {turnsUntilElection}</div>
            <button className="settings-btn" type="button" onClick={() => setSettingsOpen(true)} style={{ whiteSpace: 'nowrap' }}>
              [ SYSTEM.SETTINGS ]
            </button>
          </div>
        </header>

        <aside className="gov-sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', marginBottom: '1rem', paddingBottom: '0.2rem' }}>
            <h2 style={{ border: 'none', margin: 0 }}>REGIONAL GOVERNORS (14)</h2>
            <button
              className="settings-btn"
              style={{ fontSize: '0.7rem' }}
              onClick={() => setGovSortMode(current => current === 'default' ? 'loyalty' : 'default')}
            >
              [ SORT: {govSortMode === 'default' ? 'ORIG' : 'LOYALTY'} ]
            </button>
          </div>
          <ul className="gov-list">
            {sortedRegions.map((region) => {
              const governor = GOVERNORS[region];
              const loyalty = game.regionLoyalty[region] ?? 0;
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
            })}
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
        </section>

        {settingsOpen ? (
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Game settings">
            <div className="settings-modal-panel">
              <h2 className="glow-amber" style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginTop: 0 }}>[ SYSTEM.SETTINGS ]</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-alert)' }}>
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

        {electionModalUi}
      </main>
    </div>
  );
}

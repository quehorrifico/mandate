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
} from './lib/cardSelection.js';
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
  return `${ending.definition.title}: ${ending.definition.summary} ${tenure}`;
}

function getNoConfidenceResult(turn: number, regionLoyalty: RegionLoyaltyByRegion): ElectionResult {
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
    passed: votesFor >= ELECTION_MAJORITY,
    forVotes,
    againstVotes,
  };
}

function getElectionRegionLabel(region: (typeof REGION_KEYS)[number]): string {
  return GOVERNORS[region]?.futureRegionName ?? region.replace(/_/g, ' ');
}

export default function App() {
  const [game, setGame] = useState<GameState>(() => loadGameState() ?? createNewGameState());
  const [previewDirection, setPreviewDirection] = useState<Direction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [electionModal, setElectionModal] = useState<ElectionResult | null>(null);
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

  const advisorBias = selectedAdvisor?.bias;
  const needsAdvisorSelection = !selectedAdvisor && game.turn === 0 && !game.gameOver;
  const currentYear = useMemo(() => Math.floor(game.turn / 12) + 1, [game.turn]);
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
      },
      card: currentCard,
      direction: previewDirection,
    });
    
    return resolution.next.stats;
  }, [currentCard, game.gameOver, game.stats, game.hiddenStats, game.regionLoyalty, game.malikRewriteActive, previewDirection]);

  const dismissElectionModal = useCallback(() => {
    setElectionModal(null);
  }, []);

  const electionModalUi = electionModal ? (
    <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Election results">
      <div className="settings-modal-panel" style={{ maxWidth: '600px' }}>
        <h2 className="glow-amber" style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginTop: 0 }}>[ NO-CONFIDENCE VOTE RESULTS ]</h2>
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
    setGame(createNewGameState(null));
  }, []);

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
      }, [selectedAdvisor, game.gameOver, game.malikCooldown, currentCard]);

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
          const nextHiddenStats = resolution.next.hiddenStats;
          const nextRegionLoyalty = resolution.next.regionLoyalty;
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
        const noConfidence = getNoConfidenceResult(nextTurn, nextRegionLoyalty);
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

  if (game.gameOver) {
    return (
      <div className="app-shell">
        <GameOver
          reason={game.gameOverReason}
          turns={game.turn}
          year={currentYear}
          endingSummary={game.endingSummary}
          onRestart={startNewGame}
        />
        {electionModalUi}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main className="game-layout">
        <header className="top-strip">
          <StatsBar stats={game.stats} previewStats={previewStats} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end', fontSize: '0.8rem' }}>
            <div className="glow-amber">ADVISOR: {selectedAdvisor ? selectedAdvisor.name.toUpperCase() : 'UNASSIGNED'}</div>
            <div className="glow-green">TERM {currentTerm}/3 | YR {currentYear}</div>
            <button className="settings-btn" type="button" onClick={() => setSettingsOpen(true)} style={{ whiteSpace: 'nowrap' }}>
              [ SYSTEM.SETTINGS ]
            </button>
          </div>
        </header>

        <aside className="gov-sidebar">
          <h2>REGIONAL GOVERNORS (14)</h2>
          <ul className="gov-list">
            {REGION_KEYS.map((region) => {
              const governor = GOVERNORS[region];
              const loyalty = game.regionLoyalty[region] ?? 0;
              const state = getRegionLoyaltyState(loyalty);
              let statusClass = 'gov-status-neutral';
              if (state === 'loyalist' || state === 'supportive') statusClass = 'gov-status-loyal';
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
              card={currentCard}
              disabled={!!electionModal || settingsOpen}
              malikRewriteActive={game.malikRewriteActive}
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
            onAction={onAdvisorAction}
          />
        </section>

        {needsAdvisorSelection ? (
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Select an advisor">
            <div className="settings-modal-panel" style={{ maxWidth: '600px' }}>
              <h2 className="glow-amber" style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', marginTop: 0 }}>
                [ INITIALIZE ADVISOR SYSTEM ]
              </h2>
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
            </div>
          </section>
        ) : null}

        {settingsOpen ? (
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Game settings">
            <div className="settings-modal-panel">
              <h2>Settings</h2>
              <p>Start a fresh administration. This clears current progress and returns to advisor selection.</p>
              <div className="settings-actions">
                <button className="primary-btn" type="button" onClick={startNewGame}>
                  Start New Game
                </button>
                <button className="secondary-btn" type="button" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : null}
        {electionModalUi}
      </main>
    </div>
  );
}

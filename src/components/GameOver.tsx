import type { GameOverReason } from '../types';

interface GameOverProps {
  reason: GameOverReason;
  turns: number;
  endingSummary?: string | null;
  onRestart(): void;
}

function getReasonText(reason: GameOverReason): string {
  if (reason === 'authority') {
    return 'Authority collapsed; regional blocs now refuse federal orders.';
  }
  if (reason === 'capital') {
    return 'Capital hit -100; federal checks bounced and asset liquidations began immediately.';
  }
  if (reason === 'sustainability') {
    return 'Sustainability failed; infrastructure and resource systems collapsed faster than response capacity.';
  }
  if (reason === 'sentiment') {
    return 'Sentiment crashed and your mandate dissolved overnight.';
  }
  if (reason === 'no_confidence') {
    return 'You lost the vote of no confidence. The regional bloc coalition removed your mandate.';
  }
  if (reason === 'completed') {
    return 'Your administration survived the full mandate.';
  }
  return 'The republic could not sustain your administration.';
}

export function GameOver({ reason, turns, endingSummary, onRestart }: GameOverProps) {
  return (
    <div className="intro-screen">
      <div className="intro-panel">
        <div className="intro-header">
          <span className="glow-amber" style={{ fontSize: '0.85rem', letterSpacing: '0.15em' }}>
            FEDERAL REPUBLIC OF AMERICA — DEBRIEFING TERMINAL
          </span>
        </div>

        <h1 className="intro-title glow-amber">
          {reason === 'completed' ? 'MANDATE COMPLETE' : 'REPUBLIC COLLAPSED'}
        </h1>

        <div className="intro-section">
          <p className="intro-section-header glow-amber">&gt; STATUS REPORT</p>
          <p className="intro-body">{getReasonText(reason)}</p>
          <p className="intro-body" style={{ marginTop: '0.5rem' }}>
            <strong>Total Cards Resolved:</strong> {turns}
          </p>
        </div>

        {endingSummary && (
          <div className="intro-section">
            <p className="intro-section-header glow-amber">&gt; HISTORICAL RECORD</p>
            <p className="intro-body" style={{ fontStyle: 'italic', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{endingSummary}</p>
          </div>
        )}

        <button 
          className="advisor-action-btn intro-start-btn" 
          type="button" 
          onClick={onRestart}
          style={{ marginTop: '1rem' }}
        >
          [ START NEW ADMINISTRATION ]
        </button>
      </div>
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from 'react';
import { GOVERNORS } from '../data/governors';
import { type Card, type Direction } from '../types';

const SWIPE_THRESHOLD = 120;
const MIN_SWIPE_THRESHOLD = 110;
const MAX_SWIPE_THRESHOLD = 330;
const SWIPE_THRESHOLD_RATIO = 0.34;
const MAX_ROTATION = 10;
const PREVIEW_FALLBACK_RATIO = 0.62;
const MIN_PREVIEW_THRESHOLD = 72;
const PREVIEW_PROXIMITY_GAP = 44;

interface DecisionCardProps {
  card: Card;
  governorLoyalty?: number | null;
  pressureHint?: string | null;
  disabled?: boolean;
  malikRewriteActive?: boolean;
  isPacified?: boolean;
  isDataBroker?: boolean;
  leftBlocked?: boolean;
  rightBlocked?: boolean;
  unlockedDirection?: Direction | null;
  activeUnlock?: 'bribe' | 'force' | null;
  canBribe?: boolean;
  canForce?: boolean;
  onBribe?(direction: Direction): void;
  onForce?(direction: Direction): void;
  onChoose(direction: Direction): void;
  onPreviewDirection(direction: Direction | null): void;
}

interface PreviewThresholds {
  left: number;
  right: number;
}

function getDirectionFromX(x: number, thresholds: PreviewThresholds): Direction | null {
  if (x <= -thresholds.left) {
    return 'left';
  }
  if (x >= thresholds.right) {
    return 'right';
  }
  return null;
}

export function DecisionCard({
  card,
  disabled,
  malikRewriteActive,
  isPacified,
  isDataBroker,
  leftBlocked,
  rightBlocked,
  unlockedDirection,
  canBribe,
  canForce,
  onBribe,
  onForce,
  onChoose,
  onPreviewDirection,
  activeUnlock,
}: DecisionCardProps) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [swipeThreshold, setSwipeThreshold] = useState(SWIPE_THRESHOLD);
  const [previewThresholds, setPreviewThresholds] = useState<PreviewThresholds>({
    left: Math.round(SWIPE_THRESHOLD * PREVIEW_FALLBACK_RATIO),
    right: Math.round(SWIPE_THRESHOLD * PREVIEW_FALLBACK_RATIO),
  });

  const shellRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const leftChoiceRef = useRef<HTMLDivElement | null>(null);
  const rightChoiceRef = useRef<HTMLDivElement | null>(null);
  const startOffsetRef = useRef(0);
  const startOffsetYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const latestXRef = useRef(0);
  const latestYRef = useRef(0);
  const outgoingDirectionRef = useRef<Direction | null>(null);
  const previewDirectionRef = useRef<Direction | null>(null);
  const isAnimatingRef = useRef(false);

  const setCardPos = useCallback((newX: number, newY: number) => {
    latestXRef.current = newX;
    latestYRef.current = newY;
    setX(newX);
    setY(newY);
  }, []);

  const updatePreviewDirection = useCallback(
    (direction: Direction | null) => {
      if (previewDirectionRef.current === direction) {
        return;
      }
      previewDirectionRef.current = direction;
      onPreviewDirection(direction);
    },
    [onPreviewDirection],
  );

  const triggerSwipe = useCallback(
    (direction: Direction) => {
      if (isAnimatingRef.current) {
        return;
      }
      if (direction === 'left' && leftBlocked && unlockedDirection !== 'left') return;
      if (direction === 'right' && rightBlocked && unlockedDirection !== 'right') return;

      isAnimatingRef.current = true;
      outgoingDirectionRef.current = direction;
      updatePreviewDirection(direction);
      setIsDragging(false);
      // Defer the position move to the next frame so the CSS transition
      // (transition: transform 220ms) is active before the element moves,
      // ensuring onTransitionEnd fires and the card flies out visibly.
      const flyOutDistance = Math.max(700, swipeThreshold + 640);
      const flyY = latestYRef.current;
      requestAnimationFrame(() => {
        setCardPos(direction === 'left' ? -flyOutDistance : flyOutDistance, flyY);
      });
    },
    [setCardPos, swipeThreshold, updatePreviewDirection, leftBlocked, rightBlocked, unlockedDirection],
  );

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const updateThreshold = () => {
      const shellWidth = shell.getBoundingClientRect().width;
      const computedSwipe = Math.round(
        Math.max(MIN_SWIPE_THRESHOLD, Math.min(MAX_SWIPE_THRESHOLD, shellWidth * SWIPE_THRESHOLD_RATIO)),
      );
      setSwipeThreshold(computedSwipe);

      const fallbackPreview = Math.round(computedSwipe * PREVIEW_FALLBACK_RATIO);
      const maxPreview = Math.max(MIN_PREVIEW_THRESHOLD, computedSwipe - 12);
      let leftPreview = fallbackPreview;
      let rightPreview = fallbackPreview;

      const card = cardRef.current;
      const leftChoice = leftChoiceRef.current;
      const rightChoice = rightChoiceRef.current;

      if (card && leftChoice && rightChoice) {
        const shellRect = shell.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const leftChoiceRect = leftChoice.getBoundingClientRect();
        const rightChoiceRect = rightChoice.getBoundingClientRect();

        const cardLeftAtRest = (shellRect.width - cardRect.width) / 2;
        const cardRightAtRest = cardLeftAtRest + cardRect.width;
        const leftChoiceRight = leftChoiceRect.right - shellRect.left;
        const rightChoiceLeft = rightChoiceRect.left - shellRect.left;

        leftPreview = Math.max(cardLeftAtRest - (leftChoiceRight + PREVIEW_PROXIMITY_GAP), fallbackPreview);
        rightPreview = Math.max((rightChoiceLeft - PREVIEW_PROXIMITY_GAP) - cardRightAtRest, fallbackPreview);
      }

      const clampPreview = (value: number) =>
        Math.round(Math.max(MIN_PREVIEW_THRESHOLD, Math.min(maxPreview, value)));
      setPreviewThresholds({
        left: clampPreview(leftPreview),
        right: clampPreview(rightPreview),
      });
    };

    updateThreshold();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateThreshold);
      return () => window.removeEventListener('resize', updateThreshold);
    }

    const observer = new ResizeObserver(updateThreshold);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    isAnimatingRef.current = false;
    outgoingDirectionRef.current = null;
    pointerIdRef.current = null;
    setIsDragging(false);
    setKeyboardPreview(null);
    updatePreviewDirection(null);
    setCardPos(0, 0);
  }, [card.id, setCardPos, updatePreviewDirection]);



  useEffect(() => {
    if (!showHint) {
      return;
    }
    const timeout = window.setTimeout(() => setShowHint(false), 900);
    return () => window.clearTimeout(timeout);
  }, [showHint]);

  const [keyboardPreview, setKeyboardPreview] = useState<Direction | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (keyboardPreview === 'right') {
          setKeyboardPreview(null);
          updatePreviewDirection(null);
          setCardPos(0, 0);
          return;
        }
        if (leftBlocked && unlockedDirection !== 'left') return;
        if (keyboardPreview === 'left') {
          setKeyboardPreview(null);
          triggerSwipe('left');
        } else {
          setKeyboardPreview('left');
          updatePreviewDirection('left');
          setCardPos(-40, 0);
        }
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (keyboardPreview === 'left') {
          setKeyboardPreview(null);
          updatePreviewDirection(null);
          setCardPos(0, 0);
          return;
        }
        if (rightBlocked && unlockedDirection !== 'right') return;
        if (keyboardPreview === 'right') {
          setKeyboardPreview(null);
          triggerSwipe('right');
        } else {
          setKeyboardPreview('right');
          updatePreviewDirection('right');
          setCardPos(40, 0);
        }
        return;
      }
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        setShowHint(true);
        return;
      }

      // Any other key resets keyboard preview
      if (keyboardPreview) {
        setKeyboardPreview(null);
        updatePreviewDirection(null);
        setCardPos(0, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSwipe, disabled, keyboardPreview, updatePreviewDirection, setCardPos, leftBlocked, rightBlocked, unlockedDirection]);

  // Reset keyboard preview if mouse/pointer interaction starts
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isAnimatingRef.current) {
      return;
    }
    if (keyboardPreview) {
      setKeyboardPreview(null);
      updatePreviewDirection(null);
      setCardPos(0, 0);
    }
    pointerIdRef.current = event.pointerId;
    startOffsetRef.current = event.clientX - latestXRef.current;
    startOffsetYRef.current = event.clientY - latestYRef.current;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerIdRef.current !== event.pointerId) {
      return;
    }
    const rawX = event.clientX - startOffsetRef.current;
    const rawY = event.clientY - startOffsetYRef.current;

    // Apply soft gravity snap spots to center, left threshold, and right threshold
    let finalX = rawX;
    let finalY = rawY;
    const GRAVITY_RADIUS = 120;
    const GRAVITY_STRENGTH = 0.5;

    const points = [
      { px: 0, py: 0 },
      { px: -previewThresholds.left, py: 0 },
      { px: previewThresholds.right, py: 0 }
    ];

    let minDist = Infinity;
    let closestPt = points[0];
    for (const pt of points) {
      const dist = Math.hypot(rawX - pt.px, rawY - pt.py);
      if (dist < minDist) {
        minDist = dist;
        closestPt = pt;
      }
    }

    if (minDist < GRAVITY_RADIUS) {
      const pull = (1 - minDist / GRAVITY_RADIUS) * GRAVITY_STRENGTH;
      finalX = rawX + (closestPt.px - rawX) * pull;
      finalY = rawY + (closestPt.py - rawY) * pull;
    }

    if (finalX < 0 && leftBlocked && unlockedDirection !== 'left') {
      finalX = Math.max(finalX, -20);
    }
    if (finalX > 0 && rightBlocked && unlockedDirection !== 'right') {
      finalX = Math.min(finalX, 20);
    }

    setCardPos(finalX, finalY);
    updatePreviewDirection(getDirectionFromX(finalX, previewThresholds));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerIdRef.current = null;
    setIsDragging(false);

    const finalX = latestXRef.current;
    if (Math.abs(finalX) >= swipeThreshold) {
      triggerSwipe(finalX < 0 ? 'left' : 'right');
      return;
    }

    setCardPos(0, 0);
    updatePreviewDirection(null);
  };

  const onTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform') {
      return;
    }
    const direction = outgoingDirectionRef.current;
    if (!direction) {
      return;
    }
    isAnimatingRef.current = false;
    outgoingDirectionRef.current = null;
    // Brief blank gap before swapping to the next card
    window.setTimeout(() => {
      onChoose(direction);
    }, 160);
  };

  const rotation = useMemo(() => {
    const ratio = Math.max(-1, Math.min(1, x / swipeThreshold));
    return ratio * MAX_ROTATION;
  }, [swipeThreshold, x]);

  const cardStyle: CSSProperties = {
    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
    transition: isDragging ? 'none' : 'transform 220ms ease',
    zIndex: 10,
    position: 'relative',
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
    userSelect: 'none',
  };

  const requestGovernor = card.governor ? GOVERNORS[card.governor] : null;

  const isCrisis = typeof card.id === 'string' && card.id.startsWith('crisis-');

  let headerTitle = requestGovernor
    ? `GOVERNOR PROMPT | ${requestGovernor.futureRegionName.toUpperCase()}`
    : 'FEDERAL POLICY COUNCIL';

  let displayPrompt = isPacified
    ? '> HEIL CHANCELLOR.'
    : card.prompt;

  if (isCrisis) {
    const splitIndex = card.prompt.indexOf(': ');
    if (splitIndex !== -1) {
      const crisisName = card.prompt.substring(0, splitIndex).trim();
      headerTitle = `CRISIS: ${crisisName.toUpperCase()}`;
      if (!isPacified) {
        displayPrompt = card.prompt.substring(splitIndex + 2).trim();
      }
    } else {
      const fallbackName = card.id.replace('crisis-', '').replace(/_/g, ' ');
      headerTitle = `CRISIS: ${fallbackName.toUpperCase()}`;
    }
  }

  const displayLeftLabel = isPacified ? '' : (malikRewriteActive ? '[ REDACTED ]' : card.left.label);
  const displayRightLabel = isPacified ? '' : (malikRewriteActive ? '[ FULL ENDORSEMENT ]' : card.right.label);

  if (!isPacified && malikRewriteActive) {
    displayPrompt = `> ORIGINAL TEXT REDACTED\n> NEW PROPOSAL: INCREASE FEDERAL FUNDING TO ${requestGovernor?.futureRegionName.toUpperCase() ?? 'REGION'} IMMEDIATELY.`;
  }


  const activeBodyRender = (
    malikRewriteActive ? (
      <p className="glow-amber" style={{ whiteSpace: 'pre-line' }}>{displayPrompt}</p>
    ) : (
      displayPrompt
    )
  );

  return (
    <div className="decision-card-shell" ref={shellRef} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>

      {/* Left and Right hints removed from the sides as per user request, but their containers must remain for layout gap */}
      <div className="swipe-hint-left" style={{ flex: 1 }}></div>

      <article
        ref={cardRef}
        className={`decision-terminal ${isCrisis ? 'crisis-card' : ''}`}
        style={cardStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onTransitionEnd={onTransitionEnd}
      >
        <div className="decision-terminal-header">
          {headerTitle}
          {malikRewriteActive && <span className="glow-amber" style={{ float: 'right' }}>[ REWRITTEN ]</span>}
        </div>
        <div className="decision-terminal-body">
          {activeBodyRender}
        </div>
        <div className="decision-terminal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', pointerEvents: 'auto' }}>
          {(!isDataBroker || isPacified) ? (
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'left', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                {leftBlocked && unlockedDirection !== 'left' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                    <div className="gov-status-revolt" style={{ fontSize: '1.0rem', marginBottom: '0.2rem', fontWeight: 'bold' }}>
                      BLOCKED BY COALITION
                    </div>
                    {onForce && canForce && (
                      <button 
                        className="bribe-btn override-btn" 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onForce('left')}
                        style={{ color: 'var(--text-main)', borderColor: 'var(--text-main)' }}
                      >
                        [ AUTHORITY OVERRIDE ]
                      </button>
                    )}
                    {onBribe && (
                      <button 
                        className="bribe-btn" 
                        disabled={!canBribe} 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onBribe('left')}
                      >
                        [ BRIBE OFFICIAL ]
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                    {unlockedDirection === 'left' && activeUnlock && (
                      <span className={activeUnlock === 'bribe' ? "glow-red" : "glow-amber"} style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
                        [ {activeUnlock === 'bribe' ? 'BRIBE ACCEPTED' : 'AUTHORITY OVERRULED'} ]
                      </span>
                    )}
                    <span className="glow-amber">&lt;&lt; [{displayLeftLabel.toUpperCase()}]</span>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {rightBlocked && unlockedDirection !== 'right' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                    <div className="gov-status-revolt" style={{ fontSize: '1.0rem', marginBottom: '0.2rem', fontWeight: 'bold' }}>
                      BLOCKED BY COALITION
                    </div>
                    {onForce && canForce && (
                      <button 
                        className="bribe-btn override-btn" 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onForce('right')}
                        style={{ color: 'var(--text-main)', borderColor: 'var(--text-main)' }}
                      >
                        [ AUTHORITY OVERRIDE ]
                      </button>
                    )}
                    {onBribe && (
                      <button 
                        className="bribe-btn" 
                        disabled={!canBribe} 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onBribe('right')}
                      >
                        [ BRIBE OFFICIAL ]
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                    {unlockedDirection === 'right' && activeUnlock && (
                      <span className={activeUnlock === 'bribe' ? "glow-red" : "glow-amber"} style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
                        [ {activeUnlock === 'bribe' ? 'BRIBE ACCEPTED' : 'AUTHORITY OVERRULED'} ]
                      </span>
                    )}
                    <span className="glow-amber">[{displayRightLabel.toUpperCase()}] &gt;&gt;</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              <div className="glow-amber" style={{ textAlign: 'left', flex: 1 }}>
                {leftBlocked && unlockedDirection !== 'left' ? (
                  <>
                    <p className="gov-status-revolt" style={{ fontSize: '1.0rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>BLOCKED BY COALITION</p>
                    {onForce && canForce && (
                      <button 
                        className="bribe-btn override-btn" 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onForce('left')}
                        style={{ marginBottom: '0.4rem', color: 'var(--text-main)', borderColor: 'var(--text-main)' }}
                      >
                        [ AUTHORITY OVERRIDE ]
                      </button>
                    )}
                    {onBribe && (
                      <button 
                        className="bribe-btn" 
                        disabled={!canBribe} 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onBribe('left')}
                      >[ BRIBE OFFICIAL ]</button>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                    {unlockedDirection === 'left' && activeUnlock && (
                      <span className={activeUnlock === 'bribe' ? "glow-red" : "glow-amber"} style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
                        [ {activeUnlock === 'bribe' ? 'BRIBE ACCEPTED' : 'AUTHORITY OVERRULED'} ]
                      </span>
                    )}
                    <p style={{ textDecoration: 'underline', marginBottom: '0.5rem' }}>[ L: {displayLeftLabel.toUpperCase()} ]</p>
                    {Object.keys(card.left.regionalEffects || {}).length === 0 ? (
                      <p>&gt; NO DATA.</p>
                    ) : (
                      <>
                        {Object.entries(card.left.regionalEffects || {}).map(([stat, val]) => {
                          const regionLabel = GOVERNORS[stat as keyof typeof GOVERNORS]?.futureRegionName ?? stat;
                          return <p key={`l-r-${stat}`}>&gt; R: {regionLabel.toUpperCase()}: {val > 0 ? `+${val}` : val}</p>;
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="glow-amber" style={{ textAlign: 'right', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {rightBlocked && unlockedDirection !== 'right' ? (
                  <>
                    <p className="gov-status-revolt" style={{ fontSize: '1.0rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>BLOCKED BY COALITION</p>
                    {onForce && canForce && (
                      <button 
                        className="bribe-btn override-btn" 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onForce('right')}
                        style={{ marginBottom: '0.4rem', color: 'var(--text-main)', borderColor: 'var(--text-main)' }}
                      >
                        [ AUTHORITY OVERRIDE ]
                      </button>
                    )}
                    {onBribe && (
                      <button 
                        className="bribe-btn" 
                        disabled={!canBribe} 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onBribe('right')}
                      >[ BRIBE OFFICIAL ]</button>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                    {unlockedDirection === 'right' && activeUnlock && (
                      <span className={activeUnlock === 'bribe' ? "glow-red" : "glow-amber"} style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
                        [ {activeUnlock === 'bribe' ? 'BRIBE ACCEPTED' : 'AUTHORITY OVERRULED'} ]
                      </span>
                    )}
                    <p style={{ textDecoration: 'underline', marginBottom: '0.5rem' }}>[ R: {displayRightLabel.toUpperCase()} ]</p>
                    {Object.keys(card.right.regionalEffects || {}).length === 0 ? (
                      <p>&gt; NO DATA.</p>
                    ) : (
                      <>
                        {Object.entries(card.right.regionalEffects || {}).map(([stat, val]) => {
                          const regionLabel = GOVERNORS[stat as keyof typeof GOVERNORS]?.futureRegionName ?? stat;
                          return <p key={`r-r-${stat}`}>&gt; R: {regionLabel.toUpperCase()}: {val > 0 ? `+${val}` : val}</p>;
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </article>

      <div className="swipe-hint-right" style={{ flex: 1 }}></div>

      {showHint ? <p className="hint-text glow-amber" style={{ position: 'absolute', bottom: '-40px' }}>[ SYSTEM: SWIPE CARD OR USE ARROW KEYS ]</p> : null}
    </div>
  );
}

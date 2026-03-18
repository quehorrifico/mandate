import {
  ACTIVE_STAT_KEYS,
  STAT_DISPLAY_LABELS,
  type ActiveStatKey,
  type StatKey,
  type Stats,
  type StatBuffers,
} from '../types';

interface StatsBarProps {
  stats: Stats;
  statBuffers: StatBuffers;
  previewStats?: Stats;
  previewStatBuffers?: StatBuffers;
}

const STAT_ORDER: ActiveStatKey[] = [...ACTIVE_STAT_KEYS];
const SHORT_STAT_NAMES: Record<StatKey, string> = {
  authority: 'AUTHORITY',
  capital: 'CAPITAL',
  sentiment: 'SENTIMENT',
  sustainability: 'SUSTAINABILITY',
};

function getMeterWidth(statKey: StatKey, value: number): number {
  if (statKey === 'capital') {
    // Capital runs from -100 to 100, mapped to 0-100% width.
    return Math.max(0, Math.min(100, ((value + 100) / 200) * 100));
  }
  return Math.max(0, Math.min(100, value));
}

function renderAsciiBar(percent: number, delta: number, isDanger: boolean, isMaxed: boolean) {
  const TOTAL_BLOCKS = 10;
  const blocks = Math.max(0, Math.min(TOTAL_BLOCKS, Math.round(percent / 10)));
  const bar = '='.repeat(blocks) + '&nbsp;'.repeat(TOTAL_BLOCKS - blocks);
  
  let deltaClass = '';
  let deltaText = '';
  if (delta > 0) {
    deltaClass = 'glow-green';
    deltaText = `(+${delta})`;
  } else if (delta < 0) {
    deltaClass = 'glow-red';
    deltaText = `(${delta})`;
  }
  
  const deltaSpan = `<span class="${deltaClass}" style="display:inline-block; width:6ch; text-align:left; margin-left:1ch">${deltaText}</span>`;
  
  let barClass = isDanger ? 'metric-danger' : 'glow-amber';
  if (isMaxed) {
    barClass = 'metric-buffer';
  }
  return `<span class="${barClass}">[${bar}]</span>${deltaSpan}`;
}

export function StatsBar({ stats, statBuffers, previewStats, previewStatBuffers }: StatsBarProps) {
  return (
    <div className="metrics-container" aria-label="National status">
      {STAT_ORDER.map((key) => {
        const currentValue = stats[key];
        const currentBuffer = statBuffers[key];
        
        const displayValue = previewStats ? previewStats[key] : currentValue;
        const displayBuffer = previewStatBuffers ? previewStatBuffers[key] : currentBuffer;
        
        const delta = (displayValue + displayBuffer) - (currentValue + currentBuffer);
        const percent = getMeterWidth(key, displayValue);
        const isDanger = percent <= 30;
        const isMaxed = displayValue === 100 || displayBuffer > 0;

        let barClass = isDanger ? 'metric-danger' : 'glow-amber';
        if (isMaxed) {
          barClass = 'metric-buffer';
        }

        return (
          <div className={`metric-ascii ${barClass}`} key={key} title={STAT_DISPLAY_LABELS[key]}>
            <span className="metric-ascii-label">{SHORT_STAT_NAMES[key]}</span>
            <span 
              dangerouslySetInnerHTML={{ __html: renderAsciiBar(percent, delta, isDanger, isMaxed) }} 
            />
          </div>
        );
      })}
    </div>
  );
}

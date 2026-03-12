import {
  ACTIVE_STAT_KEYS,
  STAT_DISPLAY_LABELS,
  type ActiveStatKey,
  type StatKey,
  type Stats,
} from '../types';

interface StatsBarProps {
  stats: Stats;
  previewStats?: Stats;
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

function renderAsciiBar(percent: number, delta: number, isDanger: boolean) {
  const TOTAL_BLOCKS = 10;
  const blocks = Math.max(0, Math.min(TOTAL_BLOCKS, Math.round(percent / 10)));
  const bar = '='.repeat(blocks) + '&nbsp;'.repeat(TOTAL_BLOCKS - blocks);
  
  let deltaStr = `<span style="display:inline-block; width:5ch; text-align:left"></span>`;
  if (delta > 0) {
    deltaStr = ` <span class="glow-green" style="display:inline-block; width:5ch; text-align:left">(+${delta})</span>`;
  } else if (delta < 0) {
    deltaStr = ` <span style="color:var(--text-alert); display:inline-block; width:5ch; text-align:left">(${delta})</span>`;
  }
  
  const barClass = isDanger ? 'metric-danger' : 'glow-green';
  return `<span class="${barClass}">[${bar}]</span>${deltaStr}`;
}

export function StatsBar({ stats, previewStats }: StatsBarProps) {
  return (
    <div className="metrics-container" aria-label="National status">
      {STAT_ORDER.map((key) => {
        const currentValue = stats[key];
        const displayValue = previewStats ? previewStats[key] : currentValue;
        const delta = displayValue - currentValue;
        const percent = getMeterWidth(key, displayValue);
        const isDanger = percent <= 20;

        return (
          <div className={`metric-ascii ${isDanger ? 'metric-danger' : ''}`} key={key} title={STAT_DISPLAY_LABELS[key]}>
            <span className="metric-ascii-label">{SHORT_STAT_NAMES[key]}</span>
            <span 
              dangerouslySetInnerHTML={{ __html: renderAsciiBar(percent, delta, isDanger) }} 
            />
          </div>
        );
      })}
    </div>
  );
}

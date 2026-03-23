import { type HiddenStatKey, type HiddenStats, type VulnerabilityBucketKey } from '../types';

export const VULNERABILITY_BUCKETS: Record<VulnerabilityBucketKey, readonly HiddenStatKey[]> = {
  public_health_emergency: ['universal_healthcare', 'public_services', 'poverty_relief'],
  ecological_collapse: ['environmentalism', 'conservation', 'sustainability'],
  global_conflict: ['world_peace', 'internationalism', 'military_strength'],
  border_escalation: ['containing_immigration', 'nationalism', 'white_supremacy'],
  market_crash: ['economic_growth', 'free_market', 'entrepreneurship'],
  general_labor_strike: ['workers_rights', 'job_creation', 'unionization'],
  civil_rights_uprising: ['civil_rights', 'social_justice', 'anti_racism'],
  culture_war_paralysis: ['feminism', 'lgbt_rights', 'tradition'],
  sovereign_debt_default: ['tax_cuts', 'small_government', 'austerity'],
  domestic_terror_wave: ['security', 'fighting_crime_terrorism', 'global_justice'],
  rural_separatist_movement: ['rural_life', 'christianity', 'welfare_state'],
};

export function getBucketAverage(stats: HiddenStats, bucket: VulnerabilityBucketKey): number {
  const keys = VULNERABILITY_BUCKETS[bucket];
  if (!keys || keys.length === 0) return 0;
  
  const total = keys.reduce((sum, key) => sum + stats[key], 0);
  return total / keys.length;
}

export function isBucketVulnerable(stats: HiddenStats, bucket: VulnerabilityBucketKey): boolean {
  return getBucketAverage(stats, bucket) < 10;
}

import type { HiddenStats, Stats } from '../types';

export const ENDING_AXES = [
  'SS',
  'GS',
  'GD',
  'HN',
  'MG',
  'IE',
  'LP',
  'FR',
  'NS',
  'TV',
] as const;

export type EndingAxis = (typeof ENDING_AXES)[number];

export interface EndingDefinition {
  title: string;
  summary: string;
}

export interface EndingResolution {
  primary: EndingAxis;
  secondary: EndingAxis;
  definition: EndingDefinition;
  scores: Record<EndingAxis, number>;
}

const AXIS_SORT_ORDER: Record<EndingAxis, number> = {
  SS: 0,
  GS: 1,
  GD: 2,
  HN: 3,
  MG: 4,
  IE: 5,
  LP: 6,
  FR: 7,
  NS: 8,
  TV: 9,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function mix(pairs: Array<[value: number, weight: number]>): number {
  const weightTotal = pairs.reduce((total, [, weight]) => total + weight, 0);
  if (weightTotal <= 0) {
    return 0;
  }
  const weightedTotal = pairs.reduce((total, [value, weight]) => total + value * weight, 0);
  return weightedTotal / weightTotal;
}

function pairKey(a: EndingAxis, b: EndingAxis): string {
  return AXIS_SORT_ORDER[a] < AXIS_SORT_ORDER[b] ? `${a}|${b}` : `${b}|${a}`;
}

const ENDINGS_BY_PAIR: Record<string, EndingDefinition> = {
  [pairKey('SS', 'GS')]: {
    title: 'The Eco-Commune',
    summary:
      'You forged a peaceful, zero-growth republic. Vertical farms dot the skylines of former financial districts, and citizens work brief shifts maintaining solar arrays before dedicating their time to the arts and community. Progress is no longer measured in GDP, but in carbon negativity and gross domestic happiness. You completely decoupled society from the engine of endless consumption.',
  },
  [pairKey('SS', 'GD')]: {
    title: 'The Global Sanctuary',
    summary:
      'Endless lines of refugees process through your grand transit terminals, greeted with immediate medical care and housing vouchers. By opening the borders, you created a shining humanitarian miracle—but the cracks are showing. Doctors work 80-hour shifts, and rolling blackouts plague the overcrowded cities as the nation attempts to single-handedly shoulder the weight of a broken world.',
  },
  [pairKey('SS', 'HN')]: {
    title: 'The Chauvinist Welfare State',
    summary:
      'Behind towering, automated border walls, citizens enjoy free universities and pristine, state-funded hospitals. To be born here is to win the lottery of life. However, this utopia is maintained by a heavily militarized border guard that ruthlessly turns away desperate migrants, ensuring the wealth remains strictly within the bloodline.',
  },
  [pairKey('SS', 'MG')]: {
    title: 'The Nordic Monopoly',
    summary:
      'The megacorporations pay their astronomical tax bills with a smile, funding gold-standard public schools and a lavish social safety net. In exchange, anti-trust laws have been abolished. The same company that administers a citizen’s universal basic income also owns their apartment, curates their media consumption, and holds a monopoly on the seeds planted in their state-allotted gardens.',
  },
  [pairKey('SS', 'IE')]: {
    title: 'The Equitable Utopia',
    summary:
      'The Department of Historical Restitution manages the economy now, aggressively liquidating old generational wealth to fund expansive reparations. Monuments to old oppressors have been torn down, replaced by brutalist housing blocks dedicated to the historically displaced. It is a society built on fierce restorative justice, where equality is enforced with unforgiving bureaucratic precision.',
  },
  [pairKey('SS', 'LP')]: {
    title: "The Workers' Republic",
    summary:
      'The national assembly has been replaced by the Grand Syndicate. Every citizen is guaranteed a living wage, comprehensive healthcare, and an ironclad pension, but they belong to the union from birth to death. Strikes are illegal because the state is the union; to demand personal optionality or start a private enterprise is considered an act of economic treason.',
  },
  [pairKey('SS', 'FR')]: {
    title: 'The Austere Rationing',
    summary:
      'The Ministry of Provisioning ensures no one starves, but no one thrives. Citizens line up at gray distribution centers for their weekly allotment of standardized nutrient paste and utilitarian clothing. It is a perfectly egalitarian society, achieved by flattening the standard of living to the absolute minimum required to keep a human heart beating.',
  },
  [pairKey('SS', 'NS')]: {
    title: 'The Paternal Garrison',
    summary:
      'Healthcare and housing are plentiful, but they are distributed out of heavily fortified Quartermaster outposts. To earn your daily rations and medical credits, you must serve the state through grueling military or civic duty. The streets are perfectly safe, the children are well-fed, and everyone wakes up to the synchronized blare of the morning civic siren.',
  },
  [pairKey('SS', 'TV')]: {
    title: 'The Neo-Feudal Parish',
    summary:
      'The central government collapsed under its own weight, leaving local religious orders and patriarchal community councils to distribute alms. If you are a devout, loyal member of the congregation, the parish will feed your family and heal your sick. If you are an outcast, a non-believer, or a rebel, you will find no charity in the harsh winter.',
  },
  [pairKey('GS', 'GD')]: {
    title: 'The Earth Federation',
    summary:
      'The old flags have been lowered. A coalition of climate scientists and AI logistics networks now dictate global policy from the Geneva Spire. Entire nations have been forcibly depopulated to create massive rewilding zones, and fossil fuel executives are tried in international tribunals for crimes against the biosphere.',
  },
  [pairKey('GS', 'HN')]: {
    title: 'The Eco-Fascist State',
    summary:
      'Pristine forests and crystal-clear rivers are fiercely guarded by paramilitaries. The state views the ecosystem as a sacred extension of the national soul, purging any "foreign" elements—both invasive species and undocumented immigrants—with identical, terrifying zeal. Nature is healing, watered by the blood of the excluded.',
  },
  [pairKey('GS', 'MG')]: {
    title: 'The Green-Capital Monopoly',
    summary:
      'The atmosphere is scrubbed clean by colossal carbon-capture towers, all plastered with corporate logos. Clean air and fresh water are no longer human rights, but premium subscription services. Those who can afford the "Platinum Bio-Tier" breathe deeply in domed arcologies, while the impoverished suffocate in the unregulated, toxic smog zones below.',
  },
  [pairKey('GS', 'IE')]: {
    title: 'The Climate Justice Coalition',
    summary:
      'Indigenous land councils and marginalized climate refugees now hold veto power over the global economy. The industrialized global north has been placed under massive carbon tariffs to fund the relocation of sinking island nations. Healing the earth means dismantling the colonial structures that poisoned it, no matter the economic cost to the former empires.',
  },
  [pairKey('GS', 'LP')]: {
    title: 'The Rust-to-Green Syndicate',
    summary:
      'The coal mines are closed, but the miners haven’t lost their grip. Massive, industrialized trade unions control the geothermal plants and tidal barrages, holding cities hostage with the threat of blackout strikes. They rebuilt the world with green energy, and they run the new electrical grids like a heavily armed mafia.',
  },
  [pairKey('GS', 'FR')]: {
    title: 'The Rewilded Wasteland',
    summary:
      'The state went bankrupt, and the asphalt began to crack. Without funding for maintenance, highways have been swallowed by forests, and skyscrapers have become vertical ecosystems for local wildlife. Humanity has retreated to isolated, self-sufficient survival camps, watching in quiet awe as the earth violently erases the last centuries of their dominion.',
  },
  [pairKey('GS', 'NS')]: {
    title: 'The Climate Fortress',
    summary:
      'As the equatorial zones became uninhabitable, your nation built the Great Seawalls. Heavily armed drones patrol the borders of your agricultural zones, gunning down desperately parched refugees attempting to siphon your state-owned aquifers. You are an island of green survival in a dying, desperate world.',
  },
  [pairKey('GS', 'TV')]: {
    title: 'The Agrarian Return',
    summary:
      'The silicon chips have rusted and the server farms are silent. Communities have forcefully rejected industrial modernity, returning to the rhythm of the seasons with draft animals and heirloom crops. It is a quiet, beautiful, and backbreaking existence, where a single poor harvest or curable disease can once again wipe out an entire village.',
  },
  [pairKey('GD', 'HN')]: {
    title: "The Hypocrite's Empire",
    summary:
      'Your diplomats smile for the cameras in Geneva, shaking hands and signing grand treaties of friendship. Back home, the secret police drag dissidents from their beds under the cover of darkness. The nation projects an aura of enlightened internationalism, providing perfect cover for the dark, coercive nationalism that keeps you in power.',
  },
  [pairKey('GD', 'MG')]: {
    title: 'The Neoliberal Hegemony',
    summary:
      'Trillions of dollars in automated algorithmic trades flash across the globe every second, unhindered by borders or tariffs. The corporate elite live in floating, sovereign tax havens, completely untethered from any nation. Meanwhile, the global working class is trapped behind razor-wire checkpoints, their passports useless, entirely at the mercy of transnational capital.',
  },
  [pairKey('GD', 'IE')]: {
    title: 'The Cosmopolitan Open Society',
    summary:
      'The capital city is a chaotic, brilliant collision of a thousand different cultures, languages, and identities. Traditional national borders have been cheerfully discarded as a relic of the past. It is a vibrant, restless society, though older generations watch in quiet despair as ancient local customs are swept away in the relentless tide of globalized pluralism.',
  },
  [pairKey('GD', 'LP')]: {
    title: 'The Internationalist Union',
    summary:
      'A dockworker strike in Shanghai instantly triggers a sympathy blackout in New York and London. The nation-state is entirely secondary to the power of the Global Trade Syndicates. Capitalists are terrified, governments are paralyzed, and the international working class moves with terrifying, synchronized precision to dictate the terms of global trade.',
  },
  [pairKey('GD', 'FR')]: {
    title: 'The Hollowed State',
    summary:
      'The government buildings are mostly empty, leased out as co-working spaces. Public defense is handled by private military contractors, healthcare by multinational insurance cartels, and education by foreign tech conglomerates. You have achieved perfect fiscal balance, simply by selling the very concept of a sovereign state to the highest international bidders.',
  },
  [pairKey('GD', 'NS')]: {
    title: 'The World Police',
    summary:
      'Your aircraft carriers patrol every ocean; your military bases dot every continent. The world enjoys a tense, uninterrupted peace, maintained by the constant, looming threat of orbital strikes and special forces raids. You are the sole arbiter of international law, and you enforce it with uncompromising, imperial brutality.',
  },
  [pairKey('GD', 'TV')]: {
    title: 'The Holy Alliance',
    summary:
      'Embassies have been replaced by grand cathedrals and towering minarets. Treaties are no longer signed by secular presidents, but negotiated by high priests and supreme patriarchs. The world is divided not by lines on a map, but by ancient schisms of faith, bringing about a new era of transnational crusades and doctrinal cold wars.',
  },
  [pairKey('HN', 'MG')]: {
    title: "The Oligarch's Ethnostate",
    summary:
      'The state-run media blasts xenophobic anthems and stokes endless fury against foreign boogeymen. While the working class cheers at military parades and burns effigies of immigrants, a cabal of five ruling families quietly privatizes the nation’s remaining lithium reserves. Patriotism has become the ultimate sleight-of-hand for unchecked corporate looting.',
  },
  [pairKey('HN', 'IE')]: {
    title: 'The Assimilationist Republic',
    summary:
      'The state celebrates its diversity—as long as that diversity wears the national colors, sings the anthem, and discards its ancestral languages. Immigrants are welcomed only if they submit to rigorous "cultural purification" exams. It is a society of total civic equality, achieved by relentlessly stamping out any individual identity that doesn’t serve the Republic.',
  },
  [pairKey('HN', 'LP')]: {
    title: 'The National Syndicalist Bloc',
    summary:
      'The factories are booming, owned entirely by the workers who run them. However, a deep, paranoid xenophobia permeates the shop floors. Foreign goods are burned at the ports, and undocumented labor is brutally expelled by union-backed citizen militias. It is a worker’s paradise, built strictly and exclusively for "our own kind."',
  },
  [pairKey('HN', 'FR')]: {
    title: 'The Starving Citadel',
    summary:
      'The borders are sealed, the tariffs are absolute, and the nation is finally pure. But without foreign trade, the grocery store shelves are bare, and the power grid flickers and dies. The populace huddles around trash-can fires in the shadow of their magnificent, impenetrable border wall, starving to death in perfect isolation.',
  },
  [pairKey('HN', 'NS')]: {
    title: 'The Totalitarian Junta',
    summary:
      'Checkpoints exist on every street corner. Neighbors report neighbors to the Ministry of Homeland Purity for suspicious activities. The concept of civilian life has been completely erased; you are either a soldier, an informant, or a traitor. The nation is a perfectly secure, locked-down fortress, and its citizens are merely the inmates.',
  },
  [pairKey('HN', 'TV')]: {
    title: 'The Theocratic Homeland',
    summary:
      'The holy texts are now the supreme law of the land. Morality police roam the streets, enforcing modest dress codes and mandating daily prayer. Those who practice forbidden faiths or display foreign cultural sympathies are stripped of their citizenship and driven into the wasteland. Belonging is no longer a birthright; it is a sacrament.',
  },
  [pairKey('MG', 'IE')]: {
    title: 'Rainbow Capitalism',
    summary:
      'The megacity is a neon dazzle of progress: holographic billboards advertise gender-neutral luxury cars and ethically-sourced lifestyle brands. Every corporate board is perfectly diverse. Yet, underneath the glittering rhetoric of social justice, these same inclusive corporations pay starvation wages and brutally crush any attempt at unionization.',
  },
  [pairKey('MG', 'LP')]: {
    title: 'The Co-op Economy',
    summary:
      'Wall Street is a ghost town, its trading floors converted into sprawling indoor markets. By law, every corporation has been seized and converted into a worker-owned cooperative. The cutthroat mechanics of the free market still exist—companies fiercely compete and go bankrupt—but the profits and the pain are shared equally by the mechanics, coders, and janitors who own the shares.',
  },
  [pairKey('MG', 'FR')]: {
    title: 'The Anarcho-Capitalist Zone',
    summary:
      'The state Capitol building was sold off and turned into a luxury shopping mall. There are no taxes, no police, and no safety nets. If your house catches fire, you had better hope your subscription to the private Fire-Corp is up to date. It is a thrilling, terrifying paradise of absolute negative liberty, where cash is the only god left.',
  },
  [pairKey('MG', 'NS')]: {
    title: 'The Military-Industrial Complex',
    summary:
      'The economy has never been stronger, fueled entirely by the manufacture of autonomous slaughter-drones and orbital strike platforms. The nation doesn’t fight its own wars anymore; it simply funds, arms, and profits from a dozen perpetual proxy conflicts across the globe. Peace would mean immediate economic collapse, so the war machine must never stop feeding.',
  },
  [pairKey('MG', 'TV')]: {
    title: 'The Gilded Age Revival',
    summary:
      'A newly minted aristocracy of tech barons and industrial titans rule from sky-high penthouses. Down in the smog-choked slums, the working class is kept in line by a resurgence of fierce, puritanical work ethic preached by state-sponsored mega-churches. Poverty is once again viewed not as an economic failure, but as a moral failing of the weak.',
  },
  [pairKey('IE', 'LP')]: {
    title: 'The Intersectional Strike',
    summary:
      'The Vanguard Syndicates don’t just strike for higher wages; they strike to dismantle systemic oppression. A grievance over workplace discrimination can instantly shut down the nation’s entire logistics network. The economy has been weaponized into a tool for radical social equity, leaving traditional corporate management terrified and entirely powerless.',
  },
  [pairKey('IE', 'FR')]: {
    title: 'The DIY Liberation',
    summary:
      'The constitution guarantees absolute freedom of expression, identity, and bodily autonomy. However, the government has completely defunded public services. Mutual aid networks and decentralized anarchist collectives scramble to provide healthcare and food in a vibrant, radically free society that is constantly teetering on the edge of total material collapse.',
  },
  [pairKey('IE', 'NS')]: {
    title: 'The Progressive Empire',
    summary:
      'Equality is no longer a domestic goal; it is a weapon. Your stealth bombers drop precision-guided munitions on regimes that violate human rights, while your intelligence agencies stage coups against traditionalist patriarchies. You have built a terrifying, hyper-advanced military machine, and you use it to enforce intersectional equity across the globe at gunpoint.',
  },
  [pairKey('IE', 'TV')]: {
    title: 'The Reformed Tradition',
    summary:
      'The ancient cathedrals now fly liberation flags, and the sacred texts have been radically re-interpreted through a lens of modern social justice. The old hierarchies weren’t destroyed, but aggressively captured and turned inside out. It is a society bound by deep, traditional rituals, but dedicated entirely to the elevation of the historically oppressed.',
  },
  [pairKey('LP', 'FR')]: {
    title: 'The Self-Reliant Guilds',
    summary:
      'Washington is practically irrelevant. Power has devolved to the Neighborhood Guilds and localized trade syndicates. If a road needs paving or a school needs building, the local plumbers’ and teachers’ unions pass the hat and do it themselves. It is a gritty, hyper-local society of fierce mutual reliance, totally disconnected from federal oversight.',
  },
  [pairKey('LP', 'NS')]: {
    title: 'The Drafted Workforce',
    summary:
      'On their eighteenth birthday, every citizen receives their deployment orders: three years in the infantry, or three years in the state steel mills. There is no unemployment, because labor is a conscripted duty to the homeland. The nation operates as a single, massive, heavily armed industrial camp, forging progress through sheer, mandated discipline.',
  },
  [pairKey('LP', 'TV')]: {
    title: "The Yeoman's Republic",
    summary:
      'The coastal elites were exiled long ago. The nation is now run by a coalition of heavy-industry unions and rural farm collectives, fiercely protective of their wages and deeply suspicious of modern social shifts. It is a society of hard work, Sunday church, and closed borders, frozen in a nostalgically idealized vision of the mid-20th century.',
  },
  [pairKey('FR', 'NS')]: {
    title: 'The Mercenary State',
    summary:
      'The public libraries, parks, and hospitals have all been shuttered or sold. The state does exactly two things: it patrols the streets with heavily armored riot squads, and it bombs foreign enemies. You have created a minimalist government of pure coercion, where the only public employee left is a man with a gun.',
  },
  [pairKey('FR', 'TV')]: {
    title: 'The Puritanical Austerity',
    summary:
      'Neon signs are banned, and luxury goods carry a 500% sin tax. The state enforces a harsh, unyielding economic austerity, viewing any display of wealth or frivolity as a deep spiritual corruption. The citizens live lives of quiet, gray deprivation, convinced that their suffering on earth is the highest form of civic and holy virtue.',
  },
  [pairKey('NS', 'TV')]: {
    title: 'The Holy Inquisition',
    summary:
      'The surveillance drones don’t just watch for terrorists; they watch to see who misses Friday prayers. The Ministry of Truth monitors digital communications for moral deviance, dispatching the templar-police to vanish dissidents in the night. The nation is locked in an atmosphere of suffocating paranoia, strictly enforcing the will of God through the ultimate police state.',
  },
};

export function computeEndingAxisScores(params: {
  stats: Stats;
  hiddenStats: HiddenStats;
}): Record<EndingAxis, number> {
  const { stats, hiddenStats } = params;

  const scores: Record<EndingAxis, number> = {
    SS: mix([
      [hiddenStats.welfare_state, 0.24],
      [hiddenStats.public_services, 0.22],
      [hiddenStats.universal_healthcare, 0.22],
      [hiddenStats.poverty_relief, 0.16],
      [stats.sentiment, 0.08],
      [stats.sustainability, 0.08],
    ]),
    GS: mix([
      [hiddenStats.environmentalism, 0.34],
      [hiddenStats.conservation, 0.3],
      [hiddenStats.sustainability, 0.24],
      [stats.sustainability, 0.12],
    ]),
    GD: mix([
      [hiddenStats.world_peace, 0.32],
      [hiddenStats.internationalism, 0.32],
      [hiddenStats.global_justice, 0.26],
      [stats.authority, 0.1],
    ]),
    HN: mix([
      [hiddenStats.containing_immigration, 0.34],
      [hiddenStats.nationalism, 0.3],
      [hiddenStats.white_supremacy, 0.24],
      [stats.authority, 0.12],
    ]),
    MG: mix([
      [hiddenStats.economic_growth, 0.34],
      [hiddenStats.free_market, 0.28],
      [hiddenStats.entrepreneurship, 0.24],
      [stats.capital, 0.14],
    ]),
    IE: mix([
      [hiddenStats.civil_rights, 0.24],
      [hiddenStats.social_justice, 0.24],
      [hiddenStats.anti_racism, 0.18],
      [hiddenStats.feminism, 0.12],
      [hiddenStats.lgbt_rights, 0.12],
      [stats.sentiment, 0.1],
    ]),
    LP: mix([
      [hiddenStats.workers_rights, 0.34],
      [hiddenStats.job_creation, 0.26],
      [hiddenStats.unionization, 0.26],
      [stats.sentiment, 0.14],
    ]),
    FR: mix([
      [hiddenStats.tax_cuts, 0.28],
      [hiddenStats.small_government, 0.24],
      [hiddenStats.austerity, 0.24],
      [stats.capital, 0.14],
      [100 - hiddenStats.welfare_state, 0.1],
    ]),
    NS: mix([
      [hiddenStats.security, 0.32],
      [hiddenStats.military_strength, 0.28],
      [hiddenStats.fighting_crime_terrorism, 0.24],
      [stats.authority, 0.08],
      [stats.sustainability, 0.08],
    ]),
    TV: mix([
      [hiddenStats.tradition, 0.38],
      [hiddenStats.christianity, 0.32],
      [hiddenStats.rural_life, 0.2],
      [stats.sentiment, 0.1],
    ]),
  };

  for (const axis of ENDING_AXES) {
    scores[axis] = clamp(scores[axis], 0, 200);
  }

  return scores;
}

function getTopTwoAxes(scores: Record<EndingAxis, number>): [EndingAxis, EndingAxis] {
  const sorted = [...ENDING_AXES].sort((a, b) => {
    const byScore = scores[b] - scores[a];
    if (byScore !== 0) {
      return byScore;
    }
    return AXIS_SORT_ORDER[a] - AXIS_SORT_ORDER[b];
  });
  return [sorted[0], sorted[1]];
}

const FALLBACK_ENDING: EndingDefinition = {
  title: 'The Patchwork Republic',
  summary:
    'No single ideology managed to consolidate power. Your nation survives day-to-day on a fragile web of tactical compromises, improvised deals, and constant, exhausting gridlock. There are no grand monuments or sweeping revolutions here—only the quiet, messy, and infinitely complex reality of a democracy desperately trying to keep its head above water.',
};

export function resolveEnding(params: {
  stats: Stats;
  hiddenStats: HiddenStats;
}): EndingResolution {
  const scores = computeEndingAxisScores(params);
  const [primary, secondary] = getTopTwoAxes(scores);
  const definition = ENDINGS_BY_PAIR[pairKey(primary, secondary)] ?? FALLBACK_ENDING;
  return {
    primary,
    secondary,
    definition,
    scores,
  };
}

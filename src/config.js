// Static configuration and seed data. The MEMBERS table drives nomination
// forecasts and hearing-prep rosters. Seed nominees/bills are fallback only;
// live data from sources/ replaces them when keys are present.

export const CONGRESS = 119;
export const MODEL = process.env.MODEL || "claude-sonnet-4-6";

// Federal Register agency slugs treated as Treasury.
export const FR_AGENCIES = [
  "internal-revenue-service",
  "comptroller-of-the-currency",
  "financial-crimes-enforcement-network",
  "fiscal-service",
  "foreign-assets-control-office",
  "treasury-department",
];

// Crude Treasury-nexus filter for bills and nominations. Tune as needed.
export const TREASURY_TERMS = [
  "treasury", "internal revenue", "irs", "comptroller of the currency", "occ",
  "financial crimes", "fincen", "terrorist financing", "terrorism and financial",
  "sanctions", "ofac", "cfius", "investment security", "mint", "domestic finance",
  "international finance", "stablecoin", "digital asset", "debt limit", "tax",
];

export const COMMITTEES = {
  banking: { chamber: "senate", name: "Banking, Housing, and Urban Affairs", code: "ssbk00" },
  finance: { chamber: "senate", name: "Finance", code: "ssfi00" },
  hfsc: { chamber: "house", name: "Financial Services", code: "hsba00" },
  waysmeans: { chamber: "house", name: "Ways and Means", code: "hswm00" },
};

// Lean values: "Likely Yes" | "Swing" | "Likely No". Used for forecasts and prep.
export const MEMBERS = [
  { name: "Elizabeth Warren", party: "D", state: "MA", committee: "Banking", role: "Ranking Member", lean: "Likely No", themes: ["Deregulation", "Crypto / Tornado Cash", "FBI background checks"], note: "Case-by-case framing; leads QFR pressure and floor forcing." },
  { name: "Jack Reed", party: "D", state: "RI", committee: "Banking", lean: "Likely No", themes: ["Illicit finance", "Stablecoins / Iran"], note: "Backed Pettit; high overall opposition record." },
  { name: "Mark Warner", party: "D", state: "VA", committee: "Banking", lean: "Swing", themes: ["National security", "Market structure"], note: "Crossed for Pettit and Bessent; intel-minded." },
  { name: "Chris Van Hollen", party: "D", state: "MD", committee: "Banking", lean: "Likely No", themes: ["Ethics provisions", "Crypto conflicts"], note: "Aggressive posture; pushed ethics amendments." },
  { name: "Catherine Cortez Masto", party: "D", state: "NV", committee: "Banking", lean: "Likely No", themes: ["Consumer protection", "Nevada equities"], note: "Splits energy/finance votes on the merits." },
  { name: "Tina Smith", party: "D", state: "MN", committee: "Banking", lean: "Likely No", themes: ["Housing", "Community banks"], note: "Co-sponsored community-bank amendment." },
  { name: "Raphael Warnock", party: "D", state: "GA", committee: "Banking", lean: "Swing", themes: ["Bipartisan boards", "Fair credit"], note: "Backed Pettit; leads SEC-seat letters." },
  { name: "Andy Kim", party: "D", state: "NJ", committee: "Banking", lean: "Swing", themes: ["Vetting process", "National security"], note: "Case-by-case early, hardened after DOGE freezes." },
  { name: "Ruben Gallego", party: "D", state: "AZ", committee: "Banking", lean: "Swing", themes: ["Digital assets / CLARITY", "Stablecoins"], note: "Crossed for Pettit and Bessent; CLARITY yes in committee." },
  { name: "Lisa Blunt Rochester", party: "D", state: "DE", committee: "Banking", lean: "Likely No", themes: ["Cabinet pledge (Feb 4, 2025)", "Main Street"], note: "Pledged to oppose future Cabinet picks; backed Bessent pre-pledge." },
  { name: "Angela Alsobrooks", party: "D", state: "MD", committee: "Banking", lean: "Swing", themes: ["Stablecoin yield", "CLARITY"], note: "Crossed for Pettit; shaped CLARITY compromise." },
  { name: "Tim Scott", party: "R", state: "SC", committee: "Banking", role: "Chairman", lean: "Likely Yes", themes: ["Pace of confirmations", "Market structure"], note: "Sets the executive-session calendar." },
];

// Seed nominees (fallback when Congress.gov is unavailable). Grounded in 2025.
export const SEED_NOMINEES = [
  { name: "Jonathan McKernan", role: "Under Secretary for Domestic Finance", committee: "Banking", stage: "Floor scheduled", floor: "", committeeVote: "Party-line", committeeKind: "party", daysInStage: 34, note: "Reported; awaiting floor time." },
  { name: "Chris Pilkerton", role: "Asst. Secretary for Investment Security (CFIUS)", committee: "Banking", stage: "Committee reported", floor: "", committeeVote: "Party-line", committeeKind: "party", daysInStage: 21, note: "Banking + Finance referral." },
  { name: "Paul Hollis", role: "Director of the Mint", committee: "Banking", stage: "Hearing held", floor: "", committeeVote: "", committeeKind: "pending", daysInStage: 12, note: "Awaiting executive-session vote." },
  { name: "John Hurley", role: "Under Secretary for Terrorism & Financial Intelligence", committee: "Banking", stage: "Confirmed", floor: "51-47", committeeVote: "Bipartisan", committeeKind: "bipartisan", daysInStage: 0, note: "Bipartisan in committee, party-line on the floor." },
  { name: "Jonathan Burke", role: "Asst. Secretary for Terrorist Financing", committee: "Banking", stage: "Confirmed", floor: "53-43 en bloc", committeeVote: "Bipartisan", committeeKind: "bipartisan", daysInStage: 0, note: "Cleared committee bipartisan; en-bloc floor vote." },
  { name: "Luke Pettit", role: "Asst. Secretary for Financial Institutions", committee: "Banking", stage: "Confirmed", floor: "69-30", committeeVote: "Party-line", committeeKind: "party", daysInStage: 0, note: "Most Democratic floor crossover of the cohort." },
];

export const SEED_BILLS = [
  { id: "H.R. 3633", title: "CLARITY Act (digital asset market structure)", topic: "Digital assets", status: "Reported (Banking 15-9)", nexus: "Directs SEC/CFTC/Treasury joint rulemaking; illicit-finance and special-measures provisions." },
  { id: "CRA bundle", title: "CFPB rule disapprovals (multiple)", topic: "Consumer finance", status: "Floor votes forced", nexus: "Resolutions of disapproval affecting bureau rules within committee jurisdiction." },
];

export const SEED_HEARINGS = [
  { committee: "House Financial Services (Subcommittee)", title: "Oversight of FinCEN", witness: "Andrea Gacki, Director, FinCEN", when: "Upcoming", topics: ["Corporate Transparency Act / BOI", "AML modernization", "Crypto illicit finance"] },
];

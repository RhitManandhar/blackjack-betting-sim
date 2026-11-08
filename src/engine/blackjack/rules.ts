import type { RuleSet } from '../../shared/schema';

// Rule options are delivered in tiers (spec 5.1). Only Tier 1 is implemented and
// validated so far; anything else is refused rather than played by guesswork.

export function tier1Problems(rules: RuleSet): string[] {
  const problems: string[] = [];
  if (rules.decks !== 6 && rules.decks !== 8) problems.push('decks must be 6 or 8');
  if (rules.doubleOn !== 'any-two') problems.push('doubling must be allowed on any two cards');
  if (rules.lateSurrender) problems.push('late surrender is not supported yet');
  if (rules.maxSplitHands !== 4) problems.push('maximum split hands must be 4');
  if (rules.resplitAces) problems.push('re-splitting aces is not supported yet');
  // Penetration needs no check: the schema allows only 75% until Tier 3 (Phase 7).
  return problems;
}

export function assertTier1Rules(rules: RuleSet): void {
  const problems = tier1Problems(rules);
  if (problems.length > 0) {
    throw new RangeError(`Rule set is outside Tier 1: ${problems.join('; ')}`);
  }
}

/** Canonical cache key over every rule field, so no table is ever reused across rule sets (spec 6.1). */
export function ruleSetKey(rules: RuleSet): string {
  return [
    `${rules.decks}d`,
    rules.soft17,
    `bj${rules.blackjackPayout}`,
    rules.doubleAfterSplit ? 'das' : 'nodas',
    `dbl-${rules.doubleOn}`,
    rules.lateSurrender ? 'ls' : 'nols',
    `sp${rules.maxSplitHands}`,
    rules.resplitAces ? 'rsa' : 'norsa',
    `pen${rules.penetrationPercent}`,
  ].join('|');
}

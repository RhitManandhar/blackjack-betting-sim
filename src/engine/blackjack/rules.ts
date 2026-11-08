import type { RuleSet } from '../../shared/schema';

// Rule helpers shared by play and the solver (spec 5.1, 5.3; pins in spec 2.6).
// Every option the schema allows has passed both correctness gates (docs/validation.md).

const SUPPORTED_DECKS: readonly number[] = [1, 2, 4, 6, 8];
export const PENETRATION_MIN = 50;
export const PENETRATION_MAX = 90;
export const PENETRATION_STEP = 5;

export function supportedRuleProblems(rules: RuleSet): string[] {
  const problems: string[] = [];
  if (!SUPPORTED_DECKS.includes(rules.decks)) problems.push('decks must be 1, 2, 4, 6 or 8');
  const { penetrationPercent: penetration } = rules;
  if (
    penetration < PENETRATION_MIN ||
    penetration > PENETRATION_MAX ||
    penetration % PENETRATION_STEP !== 0
  ) {
    problems.push(
      `penetration must be ${String(PENETRATION_MIN)}-${String(PENETRATION_MAX)}% in steps of ${String(PENETRATION_STEP)}`,
    );
  }
  return problems;
}

/** The engine trusts validated input, but refuses outright anything it was never validated for. */
export function assertSupportedRules(rules: RuleSet): void {
  const problems = supportedRuleProblems(rules);
  if (problems.length > 0) throw new RangeError(`Unsupported rule set: ${problems.join('; ')}`);
}

/**
 * Spec 5.3 (pinned in 2.6): "double on 9-11" and "10-11" restrict doubling by the hand's total.
 * A soft hand's total is at least 12, so soft doubles are never allowed under a restriction.
 */
export function doubleAllowedOnTotal(rules: RuleSet, total: number): boolean {
  switch (rules.doubleOn) {
    case 'any-two':
      return true;
    case '9-11':
      return total >= 9 && total <= 11;
    case '10-11':
      return total >= 10 && total <= 11;
  }
}

/** Canonical cache key over every rule field, so no table is ever reused across rule sets (spec 6.1). */
export function ruleSetKey(rules: RuleSet): string {
  return [
    `${String(rules.decks)}d`,
    rules.soft17,
    `bj${rules.blackjackPayout}`,
    rules.doubleAfterSplit ? 'das' : 'nodas',
    `dbl-${rules.doubleOn}`,
    rules.lateSurrender ? 'ls' : 'nols',
    `sp${String(rules.maxSplitHands)}`,
    rules.resplitAces ? 'rsa' : 'norsa',
    `pen${String(rules.penetrationPercent)}`,
  ].join('|');
}

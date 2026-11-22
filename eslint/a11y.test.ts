// Phase 9d: the accessibility lint rules (eslint-plugin-jsx-a11y, strict) must stay switched on
// for every React component. Reads the real eslint.config.js, so removing or weakening the
// plugin there fails this test.
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const linter = new ESLint({ cwd: process.cwd() });

const REQUIRED_RULES = [
  'jsx-a11y/alt-text',
  'jsx-a11y/anchor-is-valid',
  'jsx-a11y/click-events-have-key-events',
  'jsx-a11y/label-has-associated-control',
  'jsx-a11y/no-autofocus',
  'jsx-a11y/no-noninteractive-element-interactions',
  'jsx-a11y/no-static-element-interactions',
  'jsx-a11y/role-has-required-aria-props',
] as const;

function severity(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry;
}

describe('accessibility lint rules', () => {
  it.each(['src/App.tsx', 'src/features/results/ResultsView.tsx'])(
    'apply as errors to %s',
    async (filePath) => {
      const config = (await linter.calculateConfigForFile(filePath)) as {
        rules?: Record<string, unknown>;
      };
      for (const rule of REQUIRED_RULES) {
        expect(severity(config.rules?.[rule]), rule).toBe(2);
      }
    },
  );
});

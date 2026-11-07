// Phase 2 exit criterion: a deliberate engine-imports-React change is blocked by lint.
// Uses the exact rule objects that eslint.config.js applies.
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { boundaryConfigs } from './boundaries.js';

const linter = new ESLint({
  cwd: process.cwd(),
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    ...boundaryConfigs,
  ],
});

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await linter.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

const blocked: readonly { name: string; filePath: string; code: string; rule: string }[] = [
  {
    name: 'engine imports React',
    filePath: 'src/engine/blackjack/round.ts',
    code: "import { useState } from 'react';\nexport const x = useState;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'engine imports react-dom/client',
    filePath: 'src/engine/simulation/runner.ts',
    code: "import { createRoot } from 'react-dom/client';\nexport const x = createRoot;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'engine imports a UI feature',
    filePath: 'src/engine/betting/flat.ts',
    code: "import { SetupScreen } from '../../features/experiment/SetupScreen';\nexport const x = SetupScreen;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'engine imports a worker module',
    filePath: 'src/engine/simulation/runner.ts',
    code: "import W from '../../workers/simulation.worker?worker';\nexport const x = W;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'shared imports the engine',
    filePath: 'src/shared/money.ts',
    code: "import { playRound } from '../engine/blackjack/round';\nexport const x = playRound;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'engine uses window',
    filePath: 'src/engine/blackjack/shoe.ts',
    code: 'export const width = window.innerWidth;',
    rule: 'no-restricted-globals',
  },
  {
    name: 'engine uses document',
    filePath: 'src/engine/statistics/online.ts',
    code: "export const el = document.createElement('div');",
    rule: 'no-restricted-globals',
  },
  {
    name: 'engine uses Math.random',
    filePath: 'src/engine/blackjack/shoe.ts',
    code: 'export const r = Math.random();',
    rule: 'no-restricted-properties',
  },
  {
    name: 'engine uses Date.now',
    filePath: 'src/engine/simulation/runner.ts',
    code: 'export const t = Date.now();',
    rule: 'no-restricted-properties',
  },
  {
    name: 'engine constructs a Date',
    filePath: 'src/engine/simulation/runner.ts',
    code: 'export const t = new Date();',
    rule: 'no-restricted-syntax',
  },
  {
    name: 'engine uses crypto',
    filePath: 'src/engine/simulation/rng.ts',
    code: 'export const seed = crypto.getRandomValues(new Uint32Array(1));',
    rule: 'no-restricted-globals',
  },
  {
    name: 'shared reaches crypto through globalThis',
    filePath: 'src/shared/seed.ts',
    code: 'export const c = globalThis.crypto;',
    rule: 'no-restricted-properties',
  },
];

const allowed: readonly { name: string; filePath: string; code: string }[] = [
  {
    name: 'engine imports shared',
    filePath: 'src/engine/betting/flat.ts',
    code: "import { type Cents } from '../../shared/money';\nexport const unit: Cents = 2000;",
  },
  {
    name: 'UI feature imports React and the engine',
    filePath: 'src/features/experiment/SetupScreen.tsx',
    code: "import { useState } from 'react';\nimport { x } from '../../engine/blackjack/round';\nexport const y = [useState, x, Math.random(), window];",
  },
  {
    name: 'engine path that merely contains the word url',
    filePath: 'src/engine/blackjack/round.ts',
    code: "import { curl } from './curl';\nexport const x = curl;",
  },
];

describe('engine boundary lint rules', () => {
  it.each(blocked)('blocks: $name', async ({ filePath, code, rule }) => {
    expect(await ruleIdsFor(filePath, code)).toContain(rule);
  });

  it.each(allowed)('allows: $name', async ({ filePath, code }) => {
    expect(await ruleIdsFor(filePath, code)).toEqual([]);
  });
});

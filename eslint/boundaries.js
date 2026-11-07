// Architecture boundaries from CLAUDE.md: the engine and shared code are pure,
// deterministic TypeScript that runs in Web Workers and Node tests.
// Exported separately so eslint/boundaries.test.ts exercises the exact rules in use.

const FORBIDDEN_UI_IMPORTS = [
  {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'echarts', 'echarts/*'],
    message: 'src/engine and src/shared must not import UI libraries (CLAUDE.md rule 3).',
  },
  {
    group: ['**/features/**', '**/workers/**'],
    message: 'Dependencies flow one way: UI and workers may import the engine, never the reverse.',
  },
  {
    regex: String.raw`\?(worker|sharedworker|url|raw|inline)(&|$)`,
    message: 'Vite asset and worker imports are browser-only; keep them out of the engine.',
  },
];

const FORBIDDEN_ENGINE_IMPORTS_FROM_SHARED = {
  group: ['**/engine/**'],
  message: 'src/shared is the bottom layer; it must not import the engine.',
};

const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'self',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'Worker',
  'postMessage',
  'requestAnimationFrame',
  'performance',
  'crypto',
  'setTimeout',
  'setInterval',
].map((name) => ({
  name,
  message: `"${name}" is a browser/runtime API. The engine must stay pure and deterministic (CLAUDE.md rules 2 and 3).`,
}));

const NON_DETERMINISTIC_CALLS = [
  {
    object: 'Math',
    property: 'random',
    message: 'Use the seeded RNG passed into the engine (CLAUDE.md rule 2).',
  },
  {
    object: 'Date',
    property: 'now',
    message: 'The engine must not read the clock (CLAUDE.md rule 2).',
  },
  {
    object: 'globalThis',
    property: 'crypto',
    message: 'Seeds are created once in the UI layer, never in the engine.',
  },
  {
    object: 'performance',
    property: 'now',
    message: 'The engine must not read the clock (CLAUDE.md rule 2).',
  },
];

const NON_DETERMINISTIC_SYNTAX = [
  {
    selector: "NewExpression[callee.name='Date']",
    message: 'The engine must not read the clock (CLAUDE.md rule 2).',
  },
  {
    selector: "MemberExpression[object.name='globalThis']",
    message: 'Do not reach browser APIs through globalThis in the engine.',
  },
];

/** @type {import('eslint').Linter.Config[]} */
export const boundaryConfigs = [
  {
    name: 'boundaries/engine-and-shared',
    files: ['src/engine/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: FORBIDDEN_UI_IMPORTS }],
      'no-restricted-globals': ['error', ...BROWSER_GLOBALS],
      'no-restricted-properties': ['error', ...NON_DETERMINISTIC_CALLS],
      'no-restricted-syntax': ['error', ...NON_DETERMINISTIC_SYNTAX],
    },
  },
  {
    name: 'boundaries/shared-is-bottom-layer',
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...FORBIDDEN_UI_IMPORTS, FORBIDDEN_ENGINE_IMPORTS_FROM_SHARED] },
      ],
    },
  },
  {
    name: 'boundaries/no-tsx-in-engine',
    files: ['src/engine/**/*.tsx', 'src/shared/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NON_DETERMINISTIC_SYNTAX,
        { selector: 'JSXElement', message: 'No JSX in src/engine or src/shared.' },
      ],
    },
  },
];

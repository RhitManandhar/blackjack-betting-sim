import { ExperimentPage } from './features/experiment/ExperimentPage';

export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-xl font-semibold">Blackjack Betting Simulator</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Compares betting systems while the player uses perfect basic strategy. No betting system
            changes the house edge; systems only reshape how results are spread. No real money.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <ExperimentPage />
      </main>
    </div>
  );
}

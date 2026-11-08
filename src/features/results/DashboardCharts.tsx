import { useMemo } from 'react';
import type { StrategySummary } from '../../engine/statistics/summary';
import {
  betProgressionOption,
  checkpointBandsOption,
  drawdownOption,
  finalProfitOption,
  stillPlayingOption,
  targetAttainmentOption,
} from './charts/dashboardCharts';
import { EChart } from './EChart';
import { usePrefersDark } from './usePrefersDark';

// Final dashboard charts (plan 8.3), each with a short note on what it shows and how to read it.

function ChartCard({
  title,
  note,
  children,
}: {
  readonly title: string;
  readonly note: string;
  readonly children: React.ReactNode;
}) {
  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <figcaption>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-slate-600 dark:text-slate-400">{note}</span>
      </figcaption>
      {children}
    </figure>
  );
}

interface DashboardChartsProps {
  readonly strategies: readonly StrategySummary[];
  readonly upsideTruncated: boolean;
}

export function DashboardCharts({ strategies, upsideTruncated }: DashboardChartsProps) {
  const dark = usePrefersDark();
  const options = useMemo(
    () => ({
      bands: checkpointBandsOption(strategies, { dark }),
      finalProfit: finalProfitOption(strategies, { dark }),
      targets: targetAttainmentOption(strategies, { dark }),
      drawdown: drawdownOption(strategies, { dark }),
      bets: betProgressionOption(strategies, { dark }),
      stillPlaying: stillPlayingOption(strategies, { dark }),
    }),
    [strategies, dark],
  );
  const hasCheckpoints = (strategies[0]?.checkpoints.length ?? 0) > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {hasCheckpoints && (
        <ChartCard
          title="Profit at checkpoints"
          note="Median line with the 5th–95th percentile band (approximate, from fixed bins). Strategies that stopped earlier are carried forward at their final profit. Click a legend entry to hide a strategy."
        >
          <EChart
            option={options.bands}
            height={320}
            ariaLabel="Profit at each checkpoint round, median and 5th to 95th percentile band per strategy"
          />
        </ChartCard>
      )}
      <ChartCard
        title="Final profit distribution"
        note={`Box: 25th to 75th percentile, line: median, whiskers: 5th and 95th percentile (exact).${upsideTruncated ? ' Upside truncated: strategies stop at their target.' : ''}`}
      >
        <EChart
          option={options.finalProfit}
          height={320}
          ariaLabel="Final profit distribution per strategy"
        />
      </ChartCard>
      <ChartCard
        title="Target attainment"
        note="Share of simulations that ever reached each target, even if profit fell back later."
      >
        <EChart
          option={options.targets}
          height={320}
          ariaLabel="Share of simulations reaching each profit target per strategy"
        />
      </ChartCard>
      <ChartCard
        title="Maximum drawdown"
        note="Largest fall from a previous bankroll peak within a simulation. Box and whiskers as above."
      >
        <EChart
          option={options.drawdown}
          height={320}
          ariaLabel="Maximum drawdown distribution per strategy"
        />
      </ChartCard>
      {hasCheckpoints && (
        <>
          <ChartCard
            title="Bet progression"
            note="Mean bet (solid) and 95th-percentile bet (dashed) at each checkpoint, among strategies still playing then."
          >
            <EChart
              option={options.bets}
              height={300}
              ariaLabel="Mean and 95th percentile bet at each checkpoint per strategy"
            />
          </ChartCard>
          <ChartCard
            title="Still playing"
            note="Share of simulations in which each strategy had not yet stopped at each checkpoint."
          >
            <EChart
              option={options.stillPlaying}
              height={300}
              ariaLabel="Share of simulations still playing at each checkpoint per strategy"
            />
          </ChartCard>
        </>
      )}
    </div>
  );
}

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
import { type DashboardChartKey, chartText } from './resultsText';
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

  const card = (key: DashboardChartKey, height: number) => {
    const text = chartText(key, upsideTruncated);
    return (
      <ChartCard key={key} title={text.title} note={text.note}>
        <EChart option={options[key]} height={height} ariaLabel={text.ariaLabel} />
      </ChartCard>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {hasCheckpoints && card('bands', 320)}
      {card('finalProfit', 320)}
      {card('targets', 320)}
      {card('drawdown', 320)}
      {hasCheckpoints && card('bets', 300)}
      {hasCheckpoints && card('stillPlaying', 300)}
    </div>
  );
}

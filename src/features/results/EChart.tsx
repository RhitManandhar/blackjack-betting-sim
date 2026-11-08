import { BarChart, BoxplotChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { type EChartsCoreOption, init, use as registerChartParts } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

// Thin ECharts wrapper. Only the chart types and components in use are registered, to keep the
// bundle small. The chart is created once, updated in place, resized with its container and
// disposed on unmount.

registerChartParts([
  LineChart,
  BarChart,
  BoxplotChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

interface EChartProps {
  /** Plain JSON options from the builders in ./charts. */
  readonly option: Record<string, unknown>;
  readonly height: number;
  readonly ariaLabel: string;
}

export function EChart({ option, height, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const chart = init(container, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option as EChartsCoreOption, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} role="img" aria-label={ariaLabel} style={{ height }} />;
}

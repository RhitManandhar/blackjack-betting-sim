import type { ReactNode } from 'react';

interface SettingsSectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface SettingRowProps {
  readonly label: string;
  readonly value: ReactNode;
}

export function SettingRow({ label, value }: SettingRowProps) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

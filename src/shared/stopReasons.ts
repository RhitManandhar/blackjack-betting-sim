// Spec 2.4. Per-strategy stop reasons. `cancelled` is a run status (spec 10.4), never a stop reason.

export const STOP_REASONS = ['target_reached', 'bust', 'blocked_table_max', 'round_limit'] as const;

export type StopReason = (typeof STOP_REASONS)[number];

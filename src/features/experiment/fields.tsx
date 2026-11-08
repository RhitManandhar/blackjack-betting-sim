import { useId } from 'react';

// Small accessible form fields: every input has a label, and its error and hint are linked
// with aria-describedby so screen readers announce them.

export const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 disabled:opacity-60 aria-[invalid=true]:border-red-600';

export function FieldError({ id, message }: { readonly id: string; readonly message?: string }) {
  if (message === undefined) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-700 dark:text-red-400">
      {message}
    </p>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
  readonly hint?: string;
  readonly inputMode?: 'numeric' | 'decimal' | 'text';
  readonly placeholder?: string;
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  inputMode = 'numeric',
  placeholder,
}: TextFieldProps) {
  const id = useId();
  const describedBy = [
    error === undefined ? null : `${id}-error`,
    hint === undefined ? null : `${id}-hint`,
  ]
    .filter((part) => part !== null)
    .join(' ');
  return (
    <div className="text-sm">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={inputClass}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {hint !== undefined && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

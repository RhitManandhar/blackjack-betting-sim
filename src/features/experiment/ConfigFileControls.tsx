import { useRef, useState } from 'react';
import type { ExperimentConfig } from '../../shared/schema';
import { configFileName, configToJson, parseConfigJson } from './configFile';
import { downloadText } from './download';

// Download the configuration and seed as JSON, or import one to repeat a run exactly (spec 10.8).

interface ConfigFileControlsProps {
  readonly config: ExperimentConfig | null;
  readonly disabled: boolean;
  readonly onImport: (config: ExperimentConfig) => void;
}

export function ConfigFileControls({ config, disabled, onImport }: ConfigFileControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const importFile = async (file: File) => {
    const result = parseConfigJson(await file.text());
    if (result.ok) {
      onImport(result.config);
      setMessage({ text: `Loaded ${file.name}. Press Run to repeat it exactly.`, error: false });
    } else {
      setMessage({ text: result.error, error: true });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        disabled={config === null}
        onClick={() => {
          if (config !== null) {
            downloadText(configFileName(config), configToJson(config), 'application/json');
          }
        }}
        className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
      >
        Download settings (JSON)
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
      >
        Import settings…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file !== undefined) void importFile(file);
        }}
      />
      {message !== null && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={
            message.error ? 'text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

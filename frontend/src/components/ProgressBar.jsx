/**
 * Progress bar. `value` is 0..1, or null/undefined for an indeterminate state.
 */
export default function ProgressBar({ value, label }) {
  const indeterminate = value == null
  const pct = indeterminate ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>{label}</span>
          {!indeterminate && <span>{pct}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={[
            'h-full rounded-full bg-accent transition-all',
            indeterminate ? 'w-1/3 animate-pulse' : '',
          ].join(' ')}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

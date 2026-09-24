import type { ProgressInfo } from '../lib/workerRpc.ts'

export function ProgressBar({ progress }: { progress: ProgressInfo }) {
  const pct = progress.value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress.value)) * 100)
  return (
    <div className="w-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={progress.label}>
      <div className="mb-2 flex justify-between text-sm text-zinc-300">
        <span>{progress.label}</span>
        {pct !== undefined && <span className="tabular-nums">{pct}%</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        {pct === undefined ? (
          <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-pink-400 to-orange-300" />
        ) : (
          <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-orange-300 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  )
}

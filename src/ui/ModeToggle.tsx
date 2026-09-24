import { useApp } from '../store.ts'

export function ModeToggle() {
  const { mode, setMode, config } = useApp()
  const option = (value: 'local' | 'cloud', title: string, hint: string, disabled = false) => (
    <button
      role="radio"
      aria-checked={mode === value}
      disabled={disabled}
      onClick={() => setMode(value)}
      className={`flex flex-1 flex-col items-start rounded-xl px-3 py-2 text-left transition disabled:opacity-40 ${
        mode === value ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-300'
      }`}
    >
      <span className="text-sm font-semibold">{title}</span>
      <span className={`text-xs ${mode === value ? 'text-zinc-600' : 'text-zinc-500'}`}>{hint}</span>
    </button>
  )
  return (
    <div role="radiogroup" aria-label="Quality" className="flex gap-1 rounded-2xl bg-zinc-900 p-1">
      {option('local', '⚡ Local', 'Fast · free · on device')}
      {option('cloud', '☁️ Cloud', config.cloudAvailable ? 'Best quality · ~1 min' : 'No API key configured', !config.cloudAvailable)}
    </div>
  )
}

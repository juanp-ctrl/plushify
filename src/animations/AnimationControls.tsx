import { animations } from './registry.ts'
import { useAnimStore } from './store.ts'

export function AnimationControls({ clips = [], thickness }: { clips?: string[]; thickness?: { value: number; onChange: (v: number) => void } }) {
  const { current, speed, intensity, setCurrent, setSpeed, setIntensity, randomize } = useAnimStore()

  const chip = (id: string, label: string, emoji: string) => (
    <button
      key={id}
      onClick={() => setCurrent(id)}
      aria-pressed={current === id}
      className={`flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-xs font-medium transition ${
        current === id ? 'bg-white text-zinc-900' : 'bg-zinc-800/80 text-zinc-200 active:bg-zinc-700'
      }`}
    >
      <span className="text-xl leading-none">{emoji}</span>
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <button
          onClick={() => randomize(clips)}
          className="flex shrink-0 flex-col items-center gap-0.5 rounded-2xl bg-gradient-to-br from-pink-400 to-orange-300 px-3 py-2 text-xs font-semibold text-white active:scale-95"
        >
          <span className="text-xl leading-none">🎲</span>
          Random
        </button>
        {animations.map((a) => chip(a.id, a.label, a.emoji))}
        {clips.map((name) => chip(`clip:${name}`, name, '🦴'))}
      </div>
      <div className={`grid gap-4 ${thickness ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Slider label="Speed" value={speed} min={0.25} max={3} onChange={setSpeed} format={(v) => `${v.toFixed(1)}×`} />
        <Slider label="Intensity" value={intensity} min={0} max={2} onChange={setIntensity} format={(v) => `${Math.round(v * 100)}%`} />
        {thickness && (
          <Slider label="Thickness" value={thickness.value} min={0.2} max={2} onChange={thickness.onChange} format={(v) => `${Math.round(v * 100)}%`} />
        )}
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, onChange, format }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-300">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums text-zinc-400">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-pink-300"
        aria-label={label}
      />
    </label>
  )
}

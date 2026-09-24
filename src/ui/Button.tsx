import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const styles: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-pink-400 to-orange-300 text-white shadow-lg shadow-pink-900/40 active:scale-[0.98]',
  secondary: 'bg-zinc-800 text-zinc-100 active:bg-zinc-700',
  ghost: 'bg-transparent text-zinc-300 active:bg-zinc-800',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold transition disabled:opacity-40 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

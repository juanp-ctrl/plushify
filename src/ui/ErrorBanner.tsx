import type { ReactNode } from 'react'

export function ErrorBanner({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="alert" className="w-full rounded-2xl border border-red-500/30 bg-red-950/50 p-4 text-sm text-red-100">
      <p>{message}</p>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

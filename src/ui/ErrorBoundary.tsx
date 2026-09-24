import { Component, type ReactNode } from 'react'
import { ErrorBanner } from './ErrorBanner.tsx'
import { Button } from './Button.tsx'

/** Last-resort guard so a rendering error never leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[snap3d] UI error', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="mx-auto flex h-full max-w-md items-center px-6">
        <ErrorBanner message={`Something went wrong: ${this.state.error.message}`}>
          <Button
            variant="secondary"
            className="py-2 text-sm"
            onClick={() => {
              this.setState({ error: null })
              this.props.onReset()
            }}
          >
            Start over
          </Button>
        </ErrorBanner>
      </main>
    )
  }
}

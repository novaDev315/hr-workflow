import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

type AppErrorBoundaryProps = { children: ReactNode }
type AppErrorBoundaryState = { error: Error | null }

/** Last-resort recovery screen so a render error never leaves a blank page. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="app-surface w-full max-w-[440px] p-6 sm:p-7">
          <p className="app-kicker">HRFlow Pro</p>
          <h1 className="app-page-title mt-2 text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This screen could not be shown. Your data is safe. Reload the page, or go back to
            Home and try again.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={this.handleReload}>
              Reload page
            </Button>
            <Button type="button" variant="outline" onClick={this.handleHome}>
              Go to Home
            </Button>
          </div>
        </div>
      </main>
    )
  }
}

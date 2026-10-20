import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Prevents an unexpected render error in one page from blanking the whole app.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300">
          <div className="font-medium mb-2">This page failed to render</div>
          <pre className="text-xs whitespace-pre-wrap break-all text-red-200/80">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

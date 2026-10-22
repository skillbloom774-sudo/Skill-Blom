import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/errorLog'
import ErrorFallback from './ErrorFallback'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, 'react', info.componentStack ?? undefined)
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children
  }
}
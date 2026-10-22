import { supabase } from './supabase'

async function send(message: string, stack: string, source: string) {
  const { error } = await supabase.rpc('log_client_error', {
    p_message: message.slice(0, 500),
    p_stack: stack.slice(0, 2000),
    p_path: window.location.pathname,
    p_source: source,
  })
  if (error) console.error('Error logging failed:', error)
}

export function reportError(error: unknown, source: string, extra?: string) {
  const err = error instanceof Error ? error : new Error(String(error))
  const stack = [err.stack, extra].filter(Boolean).join('\n\n')
  void send(err.message || 'Unknown error', stack, source)
}

let installed = false

// Catches errors outside React: failed scripts, async code, and rejected promises
export function installErrorHandlers() {
  if (installed) return
  installed = true

  window.addEventListener('error', (e) => {
    reportError(e.error ?? e.message, 'window')
  })
  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, 'promise')
  })
}
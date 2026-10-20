export type ErrorKind = 'connection' | 'protocol' | 'data' | 'unknown'

export interface ErrorInfo {
  kind: ErrorKind
  label: string
  message: string
}

const LABELS: Record<ErrorKind, string> = {
  connection: 'Connection',
  protocol: 'Protocol',
  data: 'Data',
  unknown: 'Error',
}

export function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err)
}

export function classifyError(message: string): ErrorKind {
  const text = message.toLowerCase()
  if (
    /not connected|connect to|connection|timed out|timeout|send request failed|read response|flush stream|broken pipe|no route/.test(
      text
    )
  ) {
    return 'connection'
  }
  if (
    /code=|remark=|not supported|not exist|not online|no permission|response code|broker does not enable/.test(
      text
    )
  ) {
    return 'protocol'
  }
  if (/parse|json|invalid utf-8|invalid message id|decode|unexpected .* shape/.test(text)) {
    return 'data'
  }
  return 'unknown'
}

export function describeError(err: unknown): ErrorInfo {
  const message = errorMessage(err)
  const kind = classifyError(message)
  return { kind, label: LABELS[kind], message }
}

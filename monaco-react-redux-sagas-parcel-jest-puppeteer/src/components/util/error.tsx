import * as React from 'react'
import { CodeWorkerError } from '../../store/types'

export function Error(props: {
  error: CodeWorkerError
  title?: string;
  evaluated: string
}) {
  const { error, title = 'ERROR', evaluated } = props
  return <div>
    <h3>{title}</h3>
    Name: {error.name}<br />
    Message: {error.message}<br />
    Stack: <pre>
      {(error.stack || '')}
    </pre>
    Evaluated: <pre>
      {(evaluated || '')}
    </pre>
  </div>
}

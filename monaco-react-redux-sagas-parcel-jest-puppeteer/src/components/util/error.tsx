import * as React from 'react'
import { CodeWorkerError } from '../../store/types'

export function Error(props: {
  error: CodeWorkerError
  title?: string;
  evaluated: string
}) {
  const { error, title = 'ERROR', evaluated } = props
  return <div className="test-error">
    <h3>{title}</h3>
      Name: <span className="error-name">{error.name}</span><br />
    Message: {error.message}<br />
    Stack: <pre>
      {(error.stack || '')}
    </pre>
    Evaluated: <pre>
      {(evaluated || '')}
    </pre>
  </div>
}

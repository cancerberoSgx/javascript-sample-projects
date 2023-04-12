// import { contextLogger, flowLogger } from '../../../factory/logger';
import { Response, Request, NextFunction } from 'express'
import { NotFoundError } from './errors'

/** catch 404 and forward to error handler */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  let err = new NotFoundError()
  next(err)
}

const errorParser = (req: Request, err: any) => {
  switch (err.name) {
    case 'InvalidParameterError':
      err.status = 400
      break
    case 'AuthenticationError':
      err.status = 401
      break
    case 'PreconditionError':
      err.status = 412
      break
    case 'NotFoundError':
      err.status = 404
      break
    case 'ForbiddenError':
      err.status = 403
      break
    default:
  }
}

export const errorHandler = function (err: any, req: Request, res: Response, next: NextFunction) {
  errorParser(req, err)
  res.status(err.status || 500)
  res.json(
    Object.assign(err.data || {}, {
      error: err.name,
      message: err.message,
      code: err.code || '',
    })
  )
}

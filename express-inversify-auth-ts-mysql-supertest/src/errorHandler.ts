// import { contextLogger, flowLogger } from '../../../factory/logger';
import { Response, Request, NextFunction } from 'express'
import { NotFoundError } from './errors'
// import { Logger } from 'winston';

// const logger: Logger = contextLogger(flowLogger);

/// catch 404 and forward to error handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  let err = new NotFoundError()
  next(err)
}

const errorParser = (req: Request, err: any) => {
  // let log: Logger = contextLogger(logger, err.id);

  // function logError(code: number): void {
  // log.error(
  //   `Error handling request: ${err.name}(${code}), message='${err.message || 'N/A'}', url=${
  //     req.originalUrl
  //   }, method=${req.method}`
  // );
  // }

  switch (err.name) {
    case 'InvalidParameterError':
      err.status = 400
      // logError(err.status);
      break
    case 'AuthenticationError':
      err.status = 401
      // logError(err.status);
      break
    case 'PreconditionError':
      err.status = 412
      // logError(err.status);
      break
    case 'NotFoundError':
      err.status = 404
      // logError(err.status);
      break
    case 'ForbiddenError':
      err.status = 403
      // logError(err.status);
      break
    default:
    // log.error('Unexpected error: ', err, {
    //   request: {
    //     url: req.url,
    //     body: req.body,
    //     query: req.query,
    //   },
    // });
  }
}

/// error handlers
export const errorHandler = function (err: any, req: Request, res: Response, next: NextFunction) {
  // console.log('errorHandler', err);
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

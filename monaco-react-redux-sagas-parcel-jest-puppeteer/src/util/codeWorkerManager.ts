import { COMPILED_ACTION } from '../store/compiled'
import { dispatch } from '../store/store'
import { CodeWorkerRequest, CodeWorkerResponse, State } from '../store/types'

/** custom queue logic for codeWorker - only 1 item and if a new one is queue the pending one is removed - so we make sure of executing only last request */
class LIFO_1_LENGTH_QUEUE {
  _queue: any[] = []
	enqueue(run:any, options:any) {
		this._queue = [run]
	}
	dequeue() {
    const v = this._queue.length ? this._queue[0] : undefined
    this._queue=[]
    return v
	}
	get size() {
		return this._queue.length;
	}
}
const PQueue = require('p-queue');
const queue = new PQueue({ concurrency: 1, queueClass: LIFO_1_LENGTH_QUEUE });
// queue.onEmpty(()=>{
//   Object.keys(_promiseResolves).forEach(k=>{
//     delete _promiseResolves[k]
//   })
// })
const _promiseResolves: { [version: string]: (...args: any[]) => any } = {}

/** the only way of client side code to request code compilation */
export function compileCode(r: CodeWorkerRequest)// : Promise<CodeWorkerResponse> 
{
  // queue.add(()=>new Promise<CodeWorkerResponse>(resolve => {
  //   _promiseResolves[r.version+''] = resolve
  //   codeWorker.postMessage(r)
  // }))
}

const TIME_BETWEEN_REQUESTS = 100

function codeWorkerListener({ data }: { data: CodeWorkerResponse }) {
  const resolve = _promiseResolves[data.version]
  if(!resolve){
    throw new Error('_promiseResolves not found for verion '+data.version)
  }
  setTimeout(()=>{
    resolve(data)
    dispatch({ type: COMPILED_ACTION.RENDER_COMPILED, payload: { response: data } })
  }, TIME_BETWEEN_REQUESTS);
}

function codeWorkerErrorListener(ev: ErrorEvent) {
  dispatch({
    type: COMPILED_ACTION.ERROR_COMPILED,
    payload: {
      error: {
        message: ev.message || ev + '',
        name: ev + '',
        stack: ev + ''
      }
    }
  })
}

// let codeWorker: Worker

// export function installCodeWWorker() {
//   // codeWorker = new Worker('../codeWorker/codeWorker.ts')
//   // codeWorker.addEventListener('message', ev => codeWorkerListener(ev))
//   // codeWorker.addEventListener('error', ev => codeWorkerErrorListener(ev))
// }


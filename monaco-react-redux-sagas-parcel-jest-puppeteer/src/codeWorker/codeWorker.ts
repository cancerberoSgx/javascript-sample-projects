// import { CodeWorkerRequest, CodeWorkerResponse, CodeWorkerResponseJsxAst } from '../store/types'
// import { extractCodeDecorations } from './extractCodeDecorations'
// import { doJSXAst } from './jsxAstCompilation'
// import { evaluate } from './evaluate';
// import { install } from 'jsx-alone-dom-dom'
// import { getGlobal, installJSXAloneAsGlobal } from 'jsx-alone-core';

// export let lastRequest: CodeWorkerRequest | undefined

// if (typeof self !== 'undefined' && typeof self.onmessage === 'object') {

//   install()

//   getGlobal().addEventListener('message', ({ data }: { data: CodeWorkerRequest }) => {

//     const t0 = Date.now()

//     const fakeJsxAstResult =  {jsxAst: {diagnostics: [], ast: {type:'', text:'', kind:'', start:0, children: [], endColumn: 0, startColumn: 0, startLineNumber: 0, end: 0, endLineNumber: 0}  }as CodeWorkerResponseJsxAst, sourceFile: undefined, project: undefined} 

// // debugger
//     const {jsxAst, sourceFile, project} = data.disableJsxAst ? fakeJsxAstResult: doJSXAst(data) // do it first so extractCodeDecorations can reuse generated sourceFile


//     // if (!lastRequest) {
//     //   lastRequest = { ...data, code: '' }
//     // }


//     const m: CodeWorkerResponse = {
//       ...{
//         version: data.version,
//         jsxSyntaxHighLight:data.disableJsxSyntaxHighLight? {classifications: []} : {
//           classifications: extractCodeDecorations(data, sourceFile, project)
//         },
//         evaluate: data.disableEvaluate ? {error: {name: 'disabled by configuration', message: 'evaluate is disabled by configuration disableEvaluate===true'}, evaluated: ''} : evaluate(data.code),
//         jsxAst
//       },
//       totalTime: Date.now() - t0
//     }
//     lastRequest = data

//     console.log('codeworker response', m);
    
//     // @ts-ignore
//     getGlobal().postMessage(m)
//   })
// }

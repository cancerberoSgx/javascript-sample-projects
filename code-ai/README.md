
in the context of javascript-sample projects this ios a node.js cli app skeleton with some tools to play around with openai and source code stuff
suuports jest tests, typescript, cli bin

# about 

idea project to use gpt or llama llm to generate code or other code related stuff. 

use cases:
 * I can ask the tool to generate code given english description.
   * write code directly to specified file & line
 * code-reviews
   * replace file or create new one with code-review rewrites
     example: given the following code, could you review it and generate code with your suggested modifications? <- gpt and llama both answers nicely
 * refactor
    can you move this code block to a funciotn in module scope
 * know how
    just ask chat to provide steps by steps guides on how to add X to current project. For example: "step by step gide to add jest to this project"


# project information inferense
need to implement info extraction from code projects, like feed llm with info like
 * infer project type
 * libraries present
 * imported/available APIs
 * current function/method context

 basically we need a tool that, given a folder, says things like:
   * language: typescript
   * libraries: axios, reactjs, material-ui
   


# interfaces
we could have many interfaces like CLI, js API, mixed CLI plus annotations in code

examples:

 * 100% cli  
   * 100% command line params I can perform an action over a file, like creating a function in a given line
   * example: code-ai --file f.js --line 14 --command create --query "create js fibonachi function"

 * cli+code annotations
   In a certain line of a file I add an annotation with a query and then just run a basic command:
   line in file: `// $code-ai: create fibonachi function`
   and then just command `code-ai f.js`

 * js api: no so important, but could be nice to use API from vscode extension instead spawning proccess


## requirements

from API we need to reference: 

 * "this file on this line and column index"
 * the next expression or statement
 * code between X and Y indexes

## important decisions: 

### language agnostic or not

 * do we want to tight us to some languages in ast references ? (need to parse js, python, etc)?
 * or we do want to remain language agnostic, only with markings on code/files 
    have dump library which only works on strings doesnt know anything about ast?
Maybe we want to be progressive: 
 * first implementy language agnostic tools and simple language referencing
 * then implement project inference like libraries, etc
 * then implement advanced ast parsing and tools for each language
    for example being able to reference ast nodes in typescript files



 (can we reuse other projects that performs this like github-linguist?)

apis:
cli
js api
future: vscode extension

oriented to typescript projects - extract near interfaces/types

basic idea: 

use prompt: 
in the context of this file.ts can you create a function that sort users by created_at in sql?


this is basically an initial barebones POC project to make a real separate app in the future





support for llama and gpt
  config params (openai api key or ollama server...)



CLI idea for shortcuts

instead of making the question IN cli args like 
code-ai --file fo.js --query "create a function that... " use can edit a file adding a line in a particular place like:

// CODE_AI: create here a function that filter users by lastConnection less than 120 hours from now with sql
and then just call:
code-ai --file fo.js




--write : write in file / line the code
   if not just print to stdout only the snippet.



## TODO

 * test https://ollama.com/library/codellama
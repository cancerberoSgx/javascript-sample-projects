
about

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


project information inferense
need to implement info extraction from code projects, like feed llm with info like
 * infer project type
 * libraries present
 * imported/available APIs
 * current function/method context

 basically we need a tool that, given a folder, says things like:
   * language: typescript
   * libraries: axios, reactjs, material-ui
   

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
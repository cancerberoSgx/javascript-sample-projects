import { executeTool } from '../src/tool/executeTool';
import { executeInFile, extractAnnotationInfo_test } from '../src/tool/executeInFile';
import { extractCodeSnippets } from '../src/tool/parsingTools';
import { registerTool } from '../src/tool/registerTool';
import { Tool, ToolOutputDestination, ToolOutputFormat, ToolRunArgs } from '../src/tool/types';

test('extractCodeSnippets', () => {
  const s = `
  Assistant: Here is the corrected version of your given code.
  
  \`\`\`typescript
  const a = 1;
  
  function f(b: number) {
    b = 1;
    return b;
  }
  \`\`\`
  
  Explanation:
  
  1. We do not use \`const\` and \`var\` together as they both are used to declare a variable. And, for best practice in TypeScript, it is recommended to use \`const\`.
  
  2. All statements in TypeScript should end with a semicolon (\`;\`), so a semicolon is added at the end of each statement.
  
  \`\`\`
  snippet without language
  \`\`\`

  3. In TypeScript, it's strongly advised to define the types of parameters in a function. So we should declare a type for the parameter \`b\` in function \`f()\`.
  
  4. The assignment \`b=1\` inside a return statement is not considered good coding practice. It can lead to confusion. It's better to split into two statements. First assign the value and then return the variable.

    \`\`\`typescript
  const a = 1;
  function f(b: number) {
    b = 1;
    return b;
  }
  \`\`\`

  just other snippet
    `;
  const results = extractCodeSnippets(s);
  expect(results).toEqual([
    {
      language: 'typescript',
      text: '  const a = 1;\n' + '  \n' + '  function f(b: number) {\n' + '    b = 1;\n' + '    return b;\n' + '  }\n' + '  ',
    },
    { language: '', text: '  snippet without language\n  ' },
    {
      language: 'typescript',
      text: '  const a = 1;\n  function f(b: number) {\n    b = 1;\n    return b;\n  }\n  ',
    },
  ]);
});

test('extractAnnotationInfo_test', () => {
  const text = `
  before content
  // @code-ai foo lorem {} 1.23 ipsum
  after content
  `;
  const result = extractAnnotationInfo_test({ fileContents: text });
  expect(result).toEqual({
    code: text,
    toolName: 'foo',
    prompt: 'lorem {} 1.23 ipsum',
    lineNumber: 2,
  });
});

test('tool review test1', async () => {
  const text = `
function a(){ return b()=true}
function b(){return Math.random()>0.5?true, false}
let C=0
function c(){C++}
  `;
  const tool_review2: Tool = {
    metadata: {
      name: 'review1',
      tags: ['review'],
      description: 'simple code review',
    },
    config: {
      llm: 'gpt',
      model: 'gpt-4o',
      prompt: `
        You are a software developer in this environment: {{environment}}
        Please print only one code snippet with your corrections of the entire given file.
        {{prompt}}
        Code:
        \`\`\`
        {{code}}
        \`\`\`
    `,
    },
  };
  const args: ToolRunArgs = {
    vars: {
      code: text,
      prompt: 'Review only function `a`',
      environment: 'javascript node.js project',
    },
    output: {
      destination: ToolOutputDestination.none,
      format: ToolOutputFormat.firstSnippet,
    },
    // dryRun: true
  };
  // this should stdout corrected code
  const r = await executeTool(tool_review2, args);
}, 20000);

test.only('inFile test1', async () => {
  const tool_create1: Tool = {
    metadata: {
      name: 'create1',
      tags: ['create'],
      description: 'creates code',
    },
    config: {
      llm: 'gpt',
      model: 'gpt-4o',
      prompt: `
        You are a software developer working on this environment: {{environment}}
        Print a single code snippet with the following requirements. Don't print any examples or comments or any existing code:
        {{prompt}}
        Code:
        \`\`\`
        {{code}}
        \`\`\`
    `,
    },
  };
  registerTool(tool_create1);

  const file = `
  function a(){ return b()=true}
  function b(){return Math.random()>0.5?true, false}
  // @code-ai create1 Function that calculates fibonacci series
  let C=0
  function c(){C++}
  `;

  const r = await executeInFile({ fileContents: file });
  console.log('SEBA', r.inFileResult);

  // const args: ToolRunArgs = {
  //   vars: {
  //     // code: file,
  //     // prompt: 'Function that calculates fibonacci series',
  //     environment: 'javascript node.js project'
  //   },
  //   output: {
  //     destination: ToolOutputDestination.none,
  //     format: ToolOutputFormat.firstSnippet,
  //   },
  //   // inFile: {
  //   //   fileContents: file,
  //   // }
  //   // dryRun: true
  // };
  // this should stdout corrected code
  // const r = await executeTool(tool_review2, args);
  // console.log(r);
}, 20000);

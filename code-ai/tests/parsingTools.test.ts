import { extractCodeSnippets } from '../src/parsingTools';

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
  // console.log(extractCodeSnippets(s));

  const results = extractCodeSnippets(s)
  expect(results).toEqual([
    {
      language: 'typescript',
      text: '  const a = 1;\n' +
        '  \n' +
        '  function f(b: number) {\n' +
        '    b = 1;\n' +
        '    return b;\n' +
        '  }\n' +
        '  '
    },
    { language: '', text: '  snippet without language\n  ' },
    {
      language: 'typescript',
      text: '  const a = 1;\n  function f(b: number) {\n    b = 1;\n    return b;\n  }\n  '
    }
  ])
  
});
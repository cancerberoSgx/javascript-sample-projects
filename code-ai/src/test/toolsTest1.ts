import { executeTool } from '../tool/executeTool';
import { Tool, ToolRunArgs, ToolOutputDestination, ToolOutputFormat } from '../tool/types';

async function review1Test() {
  // define a tool
  const tool_review1: Tool = {
    metadata: {
      name: 'review1',
      tags: ['review'],
      description: 'simple code review',
    },
    config: {
      llm: 'gpt',
      model: 'gpt-4o',
      prompt: `
Make a code review the following code detecting common mistakes. 
Take into account this code was written by a newbie.
Please print only one code snippet with your corrections of the entire given file.
Code:
\`\`\`
{{code}}
\`\`\`
    `,
    },
  };
  // use it with given code:
  const code = `
const var a = 1
function f(b) {
  return b=1
}
`;
  const args: ToolRunArgs = {
    vars: { code },
    output: {
      destination: ToolOutputDestination.stdout,
      format: ToolOutputFormat.firstSnippet,
    },
  };
  // this should stdout corrected code
  await executeTool(tool_review1, args);
}

(async () => {
  try {
    await review1Test();
    // testMustache()
  } catch (error) {
    console.error('Error:', error);
  }
})();

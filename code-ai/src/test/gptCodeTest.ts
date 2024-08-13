import { ChatMessage, getChatCompletion } from '../gpt/completionsApi';
import { extractCodeSnippets } from '../tool/parsingTools';

async function testReview1() {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are an expert developer' },
    {
      role: 'user',
      content: `
Make a code review the following code detecting common mistakes. 
Take into account this code was written by a newbie.
Please print only one code snippet with your corrections of the entire given file.
Code:
\`\`\`
const var a = 1
function f(b) {
  return b=1
}
\`\`\`
      `,
    },
  ];

  const assistantMessage = await getChatCompletion(messages);
  console.log('Assistant:', assistantMessage.content);

  console.log('Snippets: ');
  extractCodeSnippets(assistantMessage.content).forEach(s => console.log(s));
}

(async () => {
  try {
    await testReview1();
  } catch (error) {
    console.error('Error:', error);
  }
})();

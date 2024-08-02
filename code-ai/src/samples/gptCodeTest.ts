import axios from 'axios';
import { extractCodeSnippets } from '../parsingTools';

// Define the API endpoint and API key
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = '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';

// Define the type for the message
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Define the type for the response
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Function to call OpenAI Chat Completion API
async function getChatCompletion(messages: ChatMessage[]): Promise<ChatMessage> {
  try {
    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_ENDPOINT,
      {
        model: 'gpt-4', // Specify the model you want to use
        messages: messages,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const assistantMessage = response.data.choices[0].message;
    return assistantMessage;

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}




// Example usage
(async () => {

  testExtractCodeSnippets();

//   const messages: ChatMessage[] = [
//     { role: 'system', content: 'You are typescript developer' },
//     { role: 'user', content: `
// Make a code review the following code detecting common mistakes. 
// Please print only one code snippet with your corrections of the entire given file.
// Code:
// \`\`\`
// const var a = 1
// function f(b) {
//   return b=1
// }
// \`\`\`
//       ` },
//   ];

//   try {
//     const assistantMessage = await getChatCompletion(messages);
//     console.log('Assistant:', assistantMessage.content);
//   } catch (error) {
//     console.error('Error:', error);
//   }
})();



function testExtractCodeSnippets() {
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

3. In TypeScript, it's strongly advised to define the types of parameters in a function. So we should declare a type for the parameter \`b\` in function \`f()\`.

4. The assignment \`b=1\` inside a return statement is not considered good coding practice. It can lead to confusion. It's better to split into two statements. First assign the value and then return the variable.
  `;
  console.log(extractCodeSnippets(s));
}

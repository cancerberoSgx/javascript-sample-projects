import axios from 'axios';

// Define the API endpoint and API key
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


// Define the type for the message
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Define the type for the response
export interface OpenAIResponse {
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
export async function getChatCompletion(messages: ChatMessage[]): Promise<ChatMessage> {
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

  } catch (error: any) {
    console.error('Error calling OpenAI API:', error.response?.status, error.response?.data);
    throw error;
  }
}

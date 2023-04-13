// needs export OPENAI_API_KEY="apikey" - https://platform.openai.com/account/api-keys

import { OpenAI } from "langchain/llms/openai";
import { ChatPromptTemplate, HumanMessagePromptTemplate, PromptTemplate, SystemMessagePromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { CallbackManager } from "langchain/callbacks";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";

async function simple() {
  const model = new OpenAI({ temperature: 0.9 });
  const res = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log(res);
}


// https://js.langchain.com/docs/getting-started/guide-llm#prompt-templates-manage-prompts-for-llms
async function promptTemplate() {
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({
    template: template,
    inputVariables: ["product"],
  });
  const res = await prompt.format({ product: "colorful socks" });
  console.log(res);
}

// https://js.langchain.com/docs/getting-started/guide-llm#chains-combine-llms-and-prompts-in-multi-step-workflows
async function promptMultiStep() {
  const model = new OpenAI({ temperature: 0.9 });
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({
    template: template,
    inputVariables: ["product"],
  });
  const chain = new LLMChain({ llm: model, prompt: prompt });
  const res = await chain.call({ product: "colorful socks" });
  console.log(res);
}

// https://js.langchain.com/docs/getting-started/guide-llm#chains-combine-llms-and-prompts-in-multi-step-workflows
async function agents() {
  // implement an agent that loads data ?
}

// https://js.langchain.com/docs/getting-started/guide-llm#agents-dynamically-run-chains-based-on-user-input
async function memory() {
  const model = new OpenAI({});
  const memory = new BufferMemory();
  const chain = new ConversationChain({ llm: model, memory: memory });
  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log(res1);
  const res2 = await chain.call({ input: "What's my name?" });
  console.log(res2);
}

// https://js.langchain.com/docs/getting-started/guide-llm#streaming
async function streaming() {
  // To enable streaming, we pass in `streaming: true` to the LLM constructor.
  // Additionally, we pass in a `CallbackManager` with a handler set up for the `handleLLMNewToken` event.
  const chat = new OpenAI({
    streaming: true,
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        process.stdout.write(token);
      },
    }),
  });
  await chat.call("Write me a song about sparkling water.");
}

// https://js.langchain.com/docs/getting-started/guide-chat#chat-models-message-in-message-out
// inquiring in chat format
async function chatFormat() {

const chat = new ChatOpenAI({ temperature: 0 });
  const response = await chat.call([
    new HumanChatMessage(
      "Translate this sentence from English to French. I love programming."
    ),
  ]);
  console.log(JSON.stringify(response, null, 2));

  //https://js.langchain.com/docs/getting-started/guide-chat#multiple-completions
  const responseC = await chat.generate([
    [
      new SystemChatMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanChatMessage(
        "Translate this sentence from English to French. I love programming."
      ),
    ],
    [
      new SystemChatMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanChatMessage(
        "Translate this sentence from English to French. I love artificial intelligence."
      ),
    ],
  ]);  
  console.log(JSON.stringify(responseC, null, 2));

  // https://js.langchain.com/docs/getting-started/guide-chat#chat-prompt-templates-manage-prompts-for-chat-models
  // chat prompts and templates
  const translationPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful assistant that translates {input_language} to {output_language}."
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);
  const responseA = await chat.generatePrompt([
    await translationPrompt.formatPromptValue({
      input_language: "English",
      output_language: "French",
      text: "I love programming.",
    }),
  ]);
  console.log(JSON.stringify(responseA, null, 2));

  // https://js.langchain.com/docs/getting-started/guide-chat#model--prompt--llmchain
  const chain = new LLMChain({
    prompt: translationPrompt,
    llm: chat,
  });
  const responseB = await chain.call({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });
  const responseD = await chain.call({
    input: "hi from London, how are you doing today",
  });
  const responseE = await chain.call({
    input: "Do you know where I am?",
  });
  console.log(JSON.stringify(responseE));
}

; (async () => {
  try {
    // await simple()
    // await promptTemplate()
    // await promptMultiStep()
    // await memory()  
    // await streaming()
    await chatFormat()
    
  } catch (error) {
    console.log('ERROR', error);
  }
})();
// needs export OPENAI_API_KEY="apikey" - https://platform.openai.com/account/api-keys

import { OpenAI } from "langchain/llms/openai";
import { ChatPromptTemplate, HumanMessagePromptTemplate, PromptTemplate, SystemMessagePromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { JSONLoader } from "langchain/document_loaders";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { CallbackManager } from "langchain/callbacks";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";

// https://python.langchain.com/en/latest/modules/chains/generic/from_hub.html
async function jsonTest() {
  const json = JSON.stringify([
    {name: 'a', description: 'nice for girls'},
    {name: 'a', description: 'nice for boys'},
  ])
  const loader = new JSONLoader(new Blob([Buffer.from(json)]))
  const documents = await loader.load()
  console.log(documents);
  
}

; (async () => {
  try {
    await jsonTest()
  } catch (error) {
    console.log('ERROR', error);
  }
})();
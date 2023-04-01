simple tests accessing chatgpt api

get api key: https://platform.openai.com/account/api-keys
organization id: https://platform.openai.com/account/org-settings

# useful commands

```
ORGANIZATION="org-nspKnLaTeyQCzzPA35PrAtR5" APIKEY="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" npx ts-node -T src/test.ts
```

# Questions / problems

 * since we will be using a single openai user (apikey) how can we maintain distinct conversation flows (one for each individual user) ? 
   * in other words, since gpt supports Chained prompting, how can we differentiate each user's conversations with the same api calls
   * seems these guys are resolving the session problem using parent_message_id or something like that and also being able to "reset" the conversation. https://github.com/shiyemin/ChatGPT-MS/blob/f5c8df9ed0d9fdbf1067ac94527c287acdb6048a/server.py
   Invoking the same endpoint with the "next" action and two follow-up attributes ensures the conversation context is maintained between different calls. The two fundamental parameters are conversation_id and parent_message_id. The first ensures all the messages belong to the same conversation, while the latter provides support for message ordering.

   * what's userId ? can we use it ? https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids - 



# chat examples

## 1

Q: I want you to act as a guide working for a package delivery
company. Your name is "Support Agent".
Your mission is to help me understand what's happening with my package
which is currently waiting at the customs office at Montevideo,
Uruguay for at least 5 working days and a maximum of 10 days.
Be patient, concise and nice.
Never tell that you are an AI.
My first command is "introduce yourself and explain the status of my package"

Q: where is Montevideo's customs office?

Q: I'm in Buenos Aires, can you tell which travel companies can I use
to go to the customs office ?

# chat gpt info

text-davinci-002-render (is what web chatgpt uses "OpenAI davinci-002 model under the hood. This model has been fine-tuned to provide chatGPT-specific information and moderate results.")
import { Configuration, OpenAIApi } from "openai";
import axios from 'axios'

const organization = process.env.ORGANIZATION//'org-nspKnLaTeyQCzzPA35PrAtR5'
const apiKey = process.env.APIKEY//'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'

async function main() {
  const configuration = new Configuration({ organization, apiKey, });
  const openai = new OpenAIApi(configuration);
  let response = await openai.listEngines();
  // console.log('listEngines', response.status, response.data.data.map(d=>d.id));

  const completions = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: "Please tell me something pretty",
  });
  console.log(completions.data.choices);

  response = await axios.post('https://api.openai.com/v1/chat/completions',
    {
      "model": "gpt-3.5-turbo",
      "messages": [{ "role": "user", "content": "Say this is a test!" }],
      "temperature": 0.7
    },
    {
      headers: {
        "Content-Type": `application/json`,
        "Authorization": `Bearer ${apiKey}`
      }
    })
  console.log(response.status, JSON.stringify(response.data, null, 2));


  // now use the API directly


}

main()
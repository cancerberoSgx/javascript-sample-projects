import { chatCompletion } from '../gpt/completionsApi';
import { renderTemplate } from '../util';
import { extractCodeSnippets } from './parsingTools';
import { Tool, ToolOutput, ToolOutputDestination, ToolOutputFormat, ToolRunArgs, ToolRunInFileArgs } from './types';

interface InFileData {
  code: string
  toolName: string
  prompt: string
}

export function extractAnnotationInfo(args: ToolRunInFileArgs): InFileData|null {
  const defaultRegex = "@code-ai\\s*([0-9a-zA-Z]+)\\s*(.+)";
  const match = args.fileContents.match(args.annotationRegex||defaultRegex);
  if(!match){
    return null
  }
  const toolName = match[1]
  const prompt = match[2]
  if(!toolName||!prompt){
    return null
  }
  return {
    code: args.fileContents,
    toolName,
    prompt
  }
}

export async function executeTool(tool: Tool, args: ToolRunArgs): Promise<ToolOutput> {
  if(args.inFile) {
    args.vars.code = args.inFile.fileContents
    // extract prompt from file

  }
  if (tool.config.llm === 'gpt') {
    const prompt = renderTemplate(tool.config.prompt, args.vars);
    let t0 = new Date().getTime();
    const response = await chatCompletion({ prompt });
    const output: ToolOutput = {
      raw: response,
      snippets: extractCodeSnippets(response),
      llmTime: new Date().getTime() - t0,
    };

    let out = '';
    if (args.output.format === ToolOutputFormat.raw) {
      out = output.raw;
    } else if (args.output.format === ToolOutputFormat.firstSnippet) {
      // TODO: validate if !output.snippets.length ? throw error?
      out = output.snippets[0]?.text || '';
    } else {
      throw new Error('not implemented args.output.format=' + args.output.format);
    }

    if (args.output.destination === ToolOutputDestination.stdout) {
      console.log(out);
    } else {
      throw new Error('not implemented args.output.destination=' + args.output.destination);
    }
    return output;
  } else {
    throw new Error('ollama not implemented');
  }
}

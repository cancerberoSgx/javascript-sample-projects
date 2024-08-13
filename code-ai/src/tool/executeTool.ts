import { chatCompletion } from '../gpt/completionsApi';
import { renderTemplate } from '../util';
import { extractCodeSnippets } from './parsingTools';
import { getTool } from './registerTool';
import { Tool, ToolOutput, ToolOutputDestination, ToolOutputFormat, ToolRunArgs, ToolRunInFileArgs } from './types';

export async function executeTool(tool: Tool, args: ToolRunArgs): Promise<ToolOutput> {
  // if(args.inFile) {
  //   args.vars.code = args.inFile.fileContents
  //   const inFileData = extractAnnotationInfo(args.inFile)

  // }
  if (tool.config.llm === 'gpt') {
    const prompt = renderTemplate(tool.config.prompt, args.vars);
    let t0 = new Date().getTime();
    const response = args.dryRun ? '' : await chatCompletion({ prompt });
    const output: ToolOutput = {
      raw: response,
      snippets: extractCodeSnippets(response),
      llmTime: new Date().getTime() - t0,
      prompt,
      answer: ''
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
    } if (args.output.destination === ToolOutputDestination.none) {
      // console.log(out);
    } else {
      throw new Error('not implemented args.output.destination=' + args.output.destination);
    }
    output.answer = out
    return output;
  } else {
    throw new Error('ollama not implemented');
  }
}

export async function executeInFile(args: ToolRunInFileArgs) {
  const inFileData = extractAnnotationInfo(args)
  if(typeof inFileData==='string') {
    throw new Error(`Error parsing file: ${inFileData}`)
  }
  const tool = getTool(inFileData.toolName)
  if(!tool) {
    throw new Error(`Tool not found: ${inFileData.toolName}`)
  }
  const runArgs: ToolRunArgs = {
    vars: { 
      code: inFileData.code, 
      prompt: inFileData.prompt,
      environment: 'javascript node.js project'
    },
    output: {
      destination: ToolOutputDestination.none,
      format: ToolOutputFormat.firstSnippet,
    },
    // dryRun: true
  };
  const result = await executeTool(tool, runArgs)
  return result
}

interface InFileData {
  code: string
  toolName: string
  prompt: string
  lineNumber: number
}

/** returns InFileData if sucessful parse or string on error */
export function extractAnnotationInfo(args: ToolRunInFileArgs): InFileData|string {
  const defaultRegex = "@code-ai\\s*([0-9a-zA-Z]+)\\s*(.+)";
  const regexp = new RegExp(args.annotationRegex||defaultRegex)
  const match = args.fileContents.match(regexp);
  if(!match){
    return 'annotation not found'
  }
  const toolName = match[1]
  const prompt = match[2]
  if(!toolName||!prompt){
    return `invalid annotation: match=${match[0]}`
  }
  return {
    code: args.fileContents,
    toolName,
    prompt,
    lineNumber: getLineNumberOfMatch(args.fileContents, regexp)
  }
}
function getLineNumberOfMatch(text: string, regex: RegExp) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
          return i + 1; // line numbers are 1-based
      }
  }
  return -1; // return -1 if no match is found
}


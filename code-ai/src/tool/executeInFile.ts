import { executeTool } from "./executeTool";
import { getTool } from "./registerTool";
import { ToolRunInFileArgs, ToolRunArgs, ToolOutputDestination, ToolOutputFormat } from "./types";

export async function executeInFile(args: ToolRunInFileArgs) {
  const inFileData = extractAnnotationInfo(args);
  if (typeof inFileData === 'string') {
    throw new Error(`Error parsing file: ${inFileData}`);
  }
  const tool = getTool(inFileData.toolName);
  if (!tool) {
    throw new Error(`Tool not found: ${inFileData.toolName}`);
  }
  const runArgs: ToolRunArgs = {
    vars: {
      ...args.vars||{},
      code: args.fileContents,
      prompt: inFileData.prompt,
      // environment: 'javascript node.js project'
    },
    output: {
      destination: ToolOutputDestination.none,
      format: ToolOutputFormat.firstSnippet,
    },
  };
  const result = await executeTool(tool, runArgs);
  result.inFileResult = inFileData.matchInfo.prefix + '\n' + result.output + '\n' + inFileData.matchInfo.suffix;
  return result;
}

interface InFileData {
  // code: string
  toolName: string;
  prompt: string;
  matchInfo: MatchInfo;
}
/** returns InFileData if sucessful parse or string on error */

export function extractAnnotationInfo(args: ToolRunInFileArgs): InFileData | string {
  const defaultRegex = "@code-ai\\s*([0-9a-zA-Z]+)\\s*(.+)";
  const regexp = new RegExp(args.annotationRegex || defaultRegex);
  const match = args.fileContents.match(regexp);
  if (!match) {
    return 'annotation not found';
  }
  // const matchLine = match[0]
  const toolName = match[1];
  const prompt = match[2];
  if (!toolName || !prompt) {
    return `invalid annotation: match=${match[0]}`;
  }
  return {
    // code: args.fileContents,
    // matchLine,
    toolName,
    prompt,
    matchInfo: getMatchInfo(args.fileContents, regexp)
  };
}

interface MatchInfo {
  prefix: string;
  suffix: string;
  lineNumber: number;
}

function getMatchInfo(text: string, regex: RegExp): MatchInfo {
  let lineNumber = -1;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      lineNumber = i;
      break;
    }
  }
  let prefix: string = '';
  let suffix: string = '';
  // let matchText: string = ''
  if (lineNumber === -1) {
    prefix = lines.join('\n');
  } else {
    prefix = lines.slice(0, lineNumber + 1).join('\n');
    suffix = lines.slice(lineNumber + 1).join('\n');
    // matchText
  }
  return {
    prefix, suffix, lineNumber
  };
}

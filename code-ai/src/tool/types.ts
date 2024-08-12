export interface ToolMetadata {
  tags: string[];
  name: string;
  description: string;
}

export interface Tool {
  metadata: ToolMetadata;
  config: ToolConfig;
  // input: ToolInput
}

/** response format, for example, extracting first code snippet only */
export enum ToolOutputFormat {
  raw = 'raw',
  firstSnippet = 'firstSnippet',
  /** if raw response is "yes" then it exits process with status 0, otherwhise with 1 */
  yesNoExitStatus = 'yesNoExitStatus',
}

/** how the tool will action. For example, print all in stdout, or first snippet, or create a new file or modify in-file */
export enum ToolOutputDestination {
  stdout = 'stdout',
  newFile = 'newFile',
  /** writes in current file given line number */
  currentFile = 'currentFile',
}

export interface ToolConfig {
  prompt: string;
  // outputType: ToolOutputType
  llm: 'gpt' | 'ollama';
  model: string;
  // output: {
  //   destination?: ToolOutputDestination,
  //   currentFile?: string
  //   /** line number where to insert output for destination.currentFile. If none it prints at line 0 */
  //   lineNumber?: number
  //   /** name of new file for destination.newFile */
  //   newFile?: string
  //   format: ToolOutputFormat
  // }
}

export enum ToolOutputType {
  code = 'code',
  yesNo = 'yesNo',
}

export interface ToolRunArgs {
  /** to be matched in any prompt template */
  vars: { [key: string]: string };
  output: {
    /** action to perform */
    destination: ToolOutputDestination;
    format: ToolOutputFormat;
    currentFile?: string;
    /** line number where to insert output for destination.currentFile. If none it prints at line 0 */
    lineNumber?: number;
    /** name of new file for destination.newFile */
    newFile?: string;
  };
  /** this is for in-file annotations */
  inFile?: ToolRunInFileArgs
}

export interface ToolRunInFileArgs {
  fileContents: string
  annotationRegex?: string
}

export interface CodeSnippet {
  language: string;
  text: string;
}

export interface ToolOutput {
  raw: string;
  snippets: CodeSnippet[];
  llmTime: number;
}

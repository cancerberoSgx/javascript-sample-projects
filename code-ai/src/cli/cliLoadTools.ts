import fs from 'fs';
import YAML from 'yaml';
import { CliArgs } from '.';
import { Tool } from '../tool/types';
import { registerTool } from '../tool/registerTool';

/** loads default tools from local file */
export function cliRegisterTools(args: CliArgs) {
  let filePath = '';
  if (!args.config) {
    throw new Error('TODO: read config from $HOME/.code-ai or current folder');
  }
  filePath = args.config;

  const tools = parseToolsFile(filePath);
  tools.forEach(tool => registerTool(tool));
}

function parseToolsFile(filePath: string) {
  const file = fs.readFileSync(filePath, 'utf8');
  const r = YAML.parse(file);
  Object.keys(r).forEach(name => (r[name].metadata.name = name));

  const tools: Tool[] = Object.values(r);
  return tools;
}

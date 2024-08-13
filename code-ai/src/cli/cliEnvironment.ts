import { extname } from 'path';
import { CliArgs } from '.';

let env = '';
/** takes care of basic environment guessing for CLI . */
export function setEnvironment(args: CliArgs) {
  const ext = extname(args.input);
  if (ext === '.js') {
    env = 'JavaScript';
  } else if (ext === '.ts') {
    env = 'TypeScript';
  } else if (ext === '.py') {
    env = 'python';
  }
}
export function getEnvironment() {
  return env;
}

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export enum Command {
  create = 'create',
}
export interface CliArgs {
  input: string;
  command: Command;
  output?: string;
}

export function handleCli() {
  const argv = (yargs(hideBin(process.argv)) as any)
    .option('input', {
      alias: 'i',
      type: 'string',
      description: 'Input file',
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Output file, if not given it will re-write input file in place',
    })
    .demandOption(['input'], 'Please provide both name and age arguments to work with this tool')
    .help().argv;
  console.log(`Hello, ${argv.name}. You are ${argv.age} years old.`);
}

function handle(args: CliArgs) {}

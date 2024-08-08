import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = (yargs(hideBin(process.argv)) as any )
  .option('name', {
    alias: 'n',
    type: 'string',
    description: 'Your name',
  })
  .option('age', {
    alias: 'a',
    type: 'number',
    description: 'Your age',
  })
  .demandOption(['name', 'age'], 'Please provide both name and age arguments to work with this tool')
  .help()
  .argv;

console.log(`Hello, ${argv.name}. You are ${argv.age} years old.`);
import fs from 'fs';
import YAML from 'yaml';
import { Tool } from '../tool/types';

const file = fs.readFileSync('./assets/sampleTools.yml', 'utf8');
const r = YAML.parse(file);
Object.keys(r).forEach(name => (r[name].metadata.name = name));

const tools: Tool[] = Object.values(r);
console.log(tools);

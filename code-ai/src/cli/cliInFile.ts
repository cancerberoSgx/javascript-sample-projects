import { readFileSync } from "fs"
import { CliArgs } from "."
import { executeInFile } from "../tool/executeInFile";

/** we read and write files here, so we don't contaminate core code with FS apis. */

  export async function executeCliInFile(args: CliArgs&{  vars?: {[k:string]:string}}){
  const fileContents = readFileSync(args.input).toString()
  const r = await executeInFile({fileContents, vars: args.vars})
  // console.log('SEBA', r.inFileResult);
  return r
}
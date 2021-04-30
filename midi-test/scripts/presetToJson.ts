import { readdirSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

const webaudiofontdataFolder = '/Users/wyeworks/git/webaudiofontdata'
const output = 'tmp'

mkdirSync(output, { recursive: true })

readdirSync(join(webaudiofontdataFolder, 'sound'))
  .filter(f => f.endsWith('.js'))
  .forEach(file => {
    const content = readFileSync(join(webaudiofontdataFolder, 'sound', file)).toString().split('\n').map(line => {
      if (line.trim().startsWith('var ')) {
        return `return {`
      } else {
        return line
      }
    }).join('\n')
    try {
      const code = `(function(){
        ${content}
      })()`
      const result = eval(code)
      writeFileSync(join(output, file + 'on'), JSON.stringify(result, null, 2))
    } catch (error) {
      console.trace(error)
      throw error
    }
  })

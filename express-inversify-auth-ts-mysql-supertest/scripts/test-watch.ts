import * as chokidar from 'chokidar'
import { exec } from 'shelljs'

const tests = process.argv.filter(p => p.endsWith('.test.ts'))
const command = `npm run test-pick -- ${tests.map(t => `"${t}"`).join(' ')}`

runTests()
chokidar.watch(['src/**/*.ts', 'test/**/*.ts'], {}).on('change', (event, path) => {
  runTests()
})

function runTests() {
  const p = exec(command)
  if (p.code !== 0) {
    console.error(' ❌ ❌ ❌ TEST FAIL ❌ ❌ ❌ ')
  } else {
    console.error(' ✅ ✅ ✅ TEST SUCCEED ✅ ✅ ✅ ')
  }
}

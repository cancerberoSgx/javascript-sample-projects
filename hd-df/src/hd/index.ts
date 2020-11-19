import { readFileSync, readdirSync, statSync, Stats } from 'fs'

interface Options {
  path: string
}

const defaultOptions: Options = {
  path: '/'
}

async function main(options: Options) {
  options = { ...defaultOptions, ...options }
  const files = await buildFolderTree(options)
  console.log('completed', files.length);
}

interface File {
  path: string
  stats: Stats
}

async function buildFolderTree(options: Options, files: File[] = []) {
  try {
    readdirSync(options.path).map(file => {
      const fileAbs = `${options.path}/${file}`
      const stats = statSync(fileAbs)
      const entry = { path: fileAbs, stats }
      files.push(entry)
      if (stats.isDirectory()) {
        // console.log('dir', fileAbs);
        buildFolderTree({ ...options, path: fileAbs }, files)
      }
    })
  } catch (error) {
    
  }
  return files
}

(async ()=>{
  main({
    path: '/Users/wyeworks/git'
  })
})();
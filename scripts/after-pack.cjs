const fs = require('node:fs')
const path = require('node:path')

function resourcesDir(context) {
  if (context.electronPlatformName === 'darwin') {
    const name = context.packager.appInfo.productFilename
    return path.join(context.appOutDir, `${name}.app`, 'Contents', 'Resources')
  }
  return path.join(context.appOutDir, 'resources')
}

exports.default = async function afterPack(context) {
  const resources = resourcesDir(context)
  const dest = path.join(resources, 'better_sqlite3.node')
  const candidates = [
    path.join(
      resources,
      'app.asar.unpacked',
      'node_modules',
      'better-sqlite3',
      'build',
      'Release',
      'better_sqlite3.node'
    ),
    path.join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
  ]

  const src = candidates.find((file) => {
    try {
      return fs.statSync(file).isFile() && fs.statSync(file).size > 1000
    } catch {
      return false
    }
  })

  if (!src) {
    throw new Error(`afterPack: better_sqlite3.node not found (tried ${candidates.join(', ')})`)
  }

  fs.mkdirSync(resources, { recursive: true })
  fs.copyFileSync(src, dest)
}

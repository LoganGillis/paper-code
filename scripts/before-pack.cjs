const { execSync } = require('node:child_process')
const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')

const ARCH = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64' }

function nativeKind(file) {
  const buf = Buffer.alloc(4)
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, buf, 0, 4, 0)
  fs.closeSync(fd)
  if (buf[0] === 0x4d && buf[1] === 0x5a) return 'win32'
  if (buf[0] === 0xcf || buf[0] === 0xca || buf[0] === 0xfe) return 'darwin'
  if (buf[0] === 0x7f && buf[1] === 0x45) return 'linux'
  return 'unknown'
}

function sqliteDir() {
  return path.dirname(require.resolve('better-sqlite3/package.json'))
}

function sqliteNode() {
  return path.join(sqliteDir(), 'build', 'Release', 'better_sqlite3.node')
}

function assertTargetBinary(platform) {
  const file = sqliteNode()
  if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
    throw new Error(`better_sqlite3.node missing after rebuild for ${platform}`)
  }
  const kind = nativeKind(file)
  if (kind !== platform) {
    throw new Error(`better_sqlite3.node is ${kind}, need ${platform} (${file})`)
  }
}

exports.default = async function beforePack(context) {
  const arch = typeof context.arch === 'string' ? context.arch : ARCH[context.arch]
  const platform = context.electronPlatformName
  if (!arch) throw new Error(`beforePack: unknown arch ${String(context.arch)}`)
  if (!platform) throw new Error('beforePack: missing electronPlatformName')

  const electronVersion = createRequire(path.join(process.cwd(), 'package.json'))('electron/package.json').version
  const cwd = sqliteDir()

  if (platform === process.platform) {
    execSync(`pnpm exec electron-rebuild -f -w better-sqlite3 --build-from-source --arch ${arch}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_arch: arch }
    })
  } else {
    const prebuild = require.resolve('prebuild-install/bin.js', { paths: [cwd] })
    execSync(
      `node "${prebuild}" --runtime electron --target ${electronVersion} --platform ${platform} --arch ${arch}`,
      { stdio: 'inherit', cwd }
    )
  }

  assertTargetBinary(platform)
}

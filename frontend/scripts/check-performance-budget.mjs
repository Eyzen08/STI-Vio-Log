import { readdir, stat } from 'node:fs/promises'
import { extname } from 'node:path'

const dist = new URL('../dist/', import.meta.url)
const assets = await readdir(new URL('assets/', dist))
const files = await Promise.all(assets.map(async (name) => ({ name, bytes: (await stat(new URL(`assets/${name}`, dist))).size })))
const budgets = { '.js': 400_000, '.css': 200_000, '.png': 150_000, '.jpg': 300_000, '.jpeg': 300_000, '.webp': 300_000 }
const failures = files.filter(({ name, bytes }) => budgets[extname(name)] && bytes > budgets[extname(name)])

console.table(files.sort((a, b) => b.bytes - a.bytes).slice(0, 12).map(({ name, bytes }) => ({ asset: name, kilobytes: (bytes / 1000).toFixed(1) })))
if (failures.length) {
  console.error(`Performance budget exceeded: ${failures.map(({ name, bytes }) => `${name} (${bytes} bytes)`).join(', ')}`)
  process.exitCode = 1
} else {
  console.log('All production assets are within the configured transfer budgets.')
}

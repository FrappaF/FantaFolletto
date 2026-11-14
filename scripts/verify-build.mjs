import assert from 'node:assert/strict'
import { readFile, readdir, access } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve('dist')
const manifest = JSON.parse(
  await readFile(resolve(output, 'manifest.webmanifest'), 'utf8'),
)
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.scope, '/')
assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
for (const icon of manifest.icons) {
  const file = await readFile(resolve(output, icon.src.replace(/^\//, '')))
  assert.equal(file.toString('ascii', 1, 4), 'PNG')
  const [width, height] = icon.sizes.split('x').map(Number)
  assert.equal(file.readUInt32BE(16), width)
  assert.equal(file.readUInt32BE(20), height)
}
const appleIcon = await readFile(resolve(output, 'icons/apple-touch-icon.png'))
assert.equal(appleIcon.readUInt32BE(16), 180)
assert.equal(appleIcon.readUInt32BE(20), 180)
const worker = await readFile(resolve(output, 'sw.js'), 'utf8')
const cached = new Set(
  [...worker.matchAll(/url:\s*["']([^"']+)["']/g)].map((match) => match[1]),
)
assert.ok(
  cached.has('index.html'),
  'La pagina iniziale deve essere disponibile offline',
)
for (const file of await readdir(resolve(output, 'assets'))) {
  if (/\.(js|css)$/.test(file))
    assert.ok(
      cached.has(`assets/${file}`),
      `Risorsa assente dalla cache iniziale: ${file}`,
    )
}
assert.ok(
  ![...cached].some((file) => /^(https?:)|\.env|supabase\//.test(file)),
  'La cache deve contenere soltanto risorse statiche locali',
)
await access(resolve(output, '_headers'))
console.log(
  `Build PWA verificata: manifest, icone, header e ${cached.size} risorse offline.`,
)

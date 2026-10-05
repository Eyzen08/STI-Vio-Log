import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { AVATAR_PRESETS, avatarImageUrl, prepareAvatarPhoto } from '../src/lib/avatar.js'

test('all 48 unique preset images are bundled as local SVG portraits', () => {
  assert.equal(new Set(AVATAR_PRESETS.map(({ id }) => id)).size, 48)
  for (const { id } of AVATAR_PRESETS) {
    assert.equal(avatarImageUrl({ source: 'PRESET', preset_id: id }), `/avatars/${id}.svg`)
    const svg = fs.readFileSync(new URL(`../public/avatars/${id}.svg`, import.meta.url), 'utf8')
    assert.match(svg, /viewBox="0 0 100 100"/)
    assert.doesNotMatch(svg, /<script|https?:\/\/(?!www.w3.org)/)
  }
})

test('renderer accepts only bundled presets and protected photo paths', () => {
  assert.equal(avatarImageUrl({ source: 'PRESET', preset_id: '../other' }), '')
  assert.equal(avatarImageUrl({ source: 'PHOTO', photo_url: 'https://other.test/picture' }), '')
  assert.equal(avatarImageUrl({ source: 'PHOTO', photo_url: 'javascript:alert(1)' }), '')
  assert.equal(avatarImageUrl({ source: 'INITIALS', preset_id: 'portrait-01' }), '')
  assert.match(avatarImageUrl({ source: 'PHOTO', photo_url: '/api/avatars/3/photo?v=2d607aba-198a-4a5e-8864-5b5c29afc3dc' }), /\/api\/avatars\/3\/photo\?v=/)
})

test('browser upload rejects unsupported formats and oversize files before decoding', async () => {
  await assert.rejects(() => prepareAvatarPhoto({ type: 'image/svg+xml', size: 10 }), /JPEG or PNG/)
  await assert.rejects(() => prepareAvatarPhoto({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), /5 MB/)
})

test('photo preparation centers portrait images, encodes JPEG, and releases its object URL', async () => {
  const original = { Image: globalThis.Image, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  const draws = [], revoked = []
  const context = { fillRect() {}, drawImage(...args) { draws.push(args) } }
  const canvas = { getContext: () => context, toDataURL: (mime, quality) => `${mime}:${quality}` }
  globalThis.Image = class { naturalWidth = 720; naturalHeight = 1080; decode() { return Promise.resolve() } }
  globalThis.document = { createElement: () => canvas }
  URL.createObjectURL = () => 'blob:test-photo'
  URL.revokeObjectURL = (url) => revoked.push(url)
  try {
    assert.equal(await prepareAvatarPhoto({ type: 'image/png', size: 100 }), 'image/jpeg:0.9')
    assert.equal(canvas.width, 512); assert.equal(canvas.height, 512)
    assert.deepEqual(draws[0].slice(1), [0, 180, 720, 720, 0, 0, 512, 512])
    assert.deepEqual(revoked, ['blob:test-photo'])
  } finally {
    globalThis.Image = original.Image; globalThis.document = original.document
    URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke
  }
})

test('unreadable photo decoding reports an error and still releases the object URL', async () => {
  const original = { Image: globalThis.Image, create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  let revoked = false
  globalThis.Image = class { decode() { return Promise.reject(new Error('Invalid image')) } }
  URL.createObjectURL = () => 'blob:invalid-photo'
  URL.revokeObjectURL = () => { revoked = true }
  try {
    await assert.rejects(() => prepareAvatarPhoto({ type: 'image/jpeg', size: 100 }), /could not be read/)
    assert.equal(revoked, true)
  } finally { globalThis.Image = original.Image; URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke }
})

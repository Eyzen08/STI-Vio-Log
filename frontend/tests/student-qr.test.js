import test from 'node:test'
import assert from 'node:assert/strict'

import { getStudentQrPayload, qrDownloadName, renderStudentQr } from '../src/lib/studentQr.js'

test('QR payload uses only the backend-issued opaque code', () => {
  const profile = { student_number: '02000123456', qr_code: '  opaque-code-42  ', email: 'student@example.test' }
  assert.equal(getStudentQrPayload(profile), 'opaque-code-42')
})

test('missing QR values are rejected', () => {
  assert.equal(getStudentQrPayload(null), null)
  assert.equal(getStudentQrPayload({ qr_code: '   ' }), null)
  assert.equal(getStudentQrPayload({ qr_code: 123 }), null)
})

test('download filenames contain only safe characters', () => {
  assert.equal(qrDownloadName('02000/123 456'), 'sti-vio-log-02000123456-qr.png')
  assert.equal(qrDownloadName(''), 'sti-vio-log-student-qr.png')
})

test('downloaded QR artwork has a yellow frame on all four sides outside the quiet zone', async () => {
  const previousImage = globalThis.Image
  const previousDocument = globalThis.document
  const canvases = []
  globalThis.Image = class { naturalWidth = 296; naturalHeight = 100; async decode() {} }
  globalThis.document = { createElement() {
    const fills = []
    const images = []
    const context = { createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }), clearRect() {}, putImageData() {}, strokeRect() {}, fillRect(...args) { fills.push([this.fillStyle, ...args]) }, drawImage(...args) { images.push(args) }, fillText() {} }
    const canvas = { style: {}, getContext: () => context, toDataURL: () => 'data:image/png;fixture', fills, images }
    canvases.push(canvas)
    return canvas
  } }
  try {
    await renderStudentQr('opaque-fixture-code', 'fixture-logo')
    const artwork = canvases[1]
    for (const rectangle of [[0, 0, 816, 12], [0, 1012, 816, 12], [0, 0, 12, 1024], [804, 0, 12, 1024]]) assert.ok(artwork.fills.some(fill => JSON.stringify(fill) === JSON.stringify(['#ffcf24', ...rectangle])), `Missing frame side ${rectangle}`)
    assert.ok(artwork.images.some(([image, x, y]) => image === canvases[0] && x === 48 && y === 208), 'QR and quiet zone stay in their original position')
  } finally {
    if (previousImage === undefined) delete globalThis.Image
    else globalThis.Image = previousImage
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})

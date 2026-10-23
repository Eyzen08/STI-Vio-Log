import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

let RouteErrorBoundary
before(async () => {
  const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: 'src/components/RouteErrorBoundary.jsx', write: false } })
  const code = bundle.output[0].code.replace(/from "(react(?:\/[^" ]+)?)"/g, (_, id) => `from "${import.meta.resolve(id)}"`)
  RouteErrorBoundary = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
})

test('ordinary render errors show neutral guidance and keep explicit reload available', () => {
  const boundary = new RouteErrorBoundary({ children: 'Page content' })
  assert.equal(boundary.render(), 'Page content')
  boundary.state = RouteErrorBoundary.getDerivedStateFromError(new Error('private account details'))
  const html = renderToStaticMarkup(boundary.render())
  assert.match(html, /Page Could Not Load/)
  assert.match(html, /Reload Portal/)
  assert.doesNotMatch(html, /updated|private account details|Page Update Required/)
})

test('module load errors show conditional update guidance and log safe metadata', (t) => {
  const boundary = new RouteErrorBoundary({})
  const error = new TypeError('Failed to fetch dynamically imported module: https://private-url')
  boundary.state = RouteErrorBoundary.getDerivedStateFromError(error)
  assert.match(renderToStaticMarkup(boundary.render()), /portal may have been updated/)
  const logged = t.mock.method(console, 'error', () => {})
  boundary.componentDidCatch(error)
  assert.deepEqual(logged.mock.calls[0].arguments, ['Page loading failed', { code: 'MODULE_LOAD_FAILED', status: 0 }])
})

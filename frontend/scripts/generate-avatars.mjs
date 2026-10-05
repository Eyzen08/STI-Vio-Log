import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Original local vector portraits. No third-party avatar service or tracking.
const output = fileURLToPath(new URL('../public/avatars/', import.meta.url))
mkdirSync(output, { recursive: true })
const backgrounds = ['#0e9caa', '#f5bd12', '#24b875', '#ce783c', '#86c6ad', '#086daf', '#37cbe1', '#4daf42']
const skins = ['#ffdbb1', '#eabc92', '#c48d60', '#965e38', '#693f24', '#f9ca9f']
const hairColors = ['#3b261c', '#1c1c1a', '#f8d66c', '#a85c2b', '#685442', '#d98648']
const shirts = ['#0d4665', '#5c335b', '#f4bf15', '#04aba1', '#248754', '#f2eee3']
const hairstyles = [
  '<path d="M27 48V34C27 12 73 10 73 35V49L66 44V33C53 35 44 24 36 33V46Z"/>',
  '<path d="M24 83V35C24 7 76 9 76 35V83L65 73V32C52 42 44 28 36 33V73Z"/>',
  '<path d="M27 43C15 37 22 27 27 27C22 18 33 13 39 17C43 5 56 9 59 15C71 8 81 21 74 29C83 35 79 47 71 46L65 32C56 38 43 29 35 34L33 45Z"/>',
  '<path d="M28 39C28 13 70 11 73 34L69 48L63 32L36 32L32 46Z"/><path d="M29 31C27 20 35 14 41 16C40 8 55 9 57 16C66 12 73 21 70 29Z"/>',
  '<path d="M23 81V34C23 10 75 8 77 34V81L66 72V33L55 26L35 38V72Z"/><path d="M26 39Q50 15 75 39L71 23Q49 4 30 24Z"/>',
  '<path d="M27 43V30C30 9 74 13 72 34L66 44L63 29Q48 37 35 28L34 44Z"/>'
]
for (let index = 0; index < 48; index++) {
  const skin = skins[(index + Math.floor(index / 8)) % skins.length]
  const hair = hairColors[(Math.floor(index / 6) + index % 3) % hairColors.length]
  const shirt = shirts[(index + Math.floor(index / 8)) % shirts.length]
  const glasses = index >= 24 ? '<g fill="none" stroke="#30352e" stroke-width="2.1"><rect x="34" y="42" width="13" height="10" rx="4"/><rect x="53" y="42" width="13" height="10" rx="4"/><path d="M47 45H53M30 44H34M66 44H70"/></g>' : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="circle"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#circle)"><path fill="${backgrounds[index % 8]}" d="M0 0H100V100H0Z"/><g fill="${hair}">${hairstyles[index % 6]}</g><path fill="${shirt}" d="M12 100V88Q15 76 39 73H61Q85 76 88 88V100Z"/><path fill="${skin}" d="M41 62H59V75Q50 86 41 75Z"/><path fill="#000" opacity=".09" d="M41 63H59V70Q50 77 41 69Z"/><ellipse fill="${skin}" cx="32" cy="47" rx="5" ry="7"/><ellipse fill="${skin}" cx="68" cy="47" rx="5" ry="7"/><path fill="${skin}" d="M33 33Q50 22 67 33V50Q65 68 50 69Q35 68 33 50Z"/><g fill="${hair}">${hairstyles[index % 6].split('/>')[0]}/></g><g fill="#3b2d25"><circle cx="41" cy="47" r="1.7"/><circle cx="59" cy="47" r="1.7"/></g><path d="M44 58Q50 62 56 58" stroke="#fff8e8" stroke-width="2.7" fill="none" stroke-linecap="round"/>${glasses}</g></svg>`
  writeFileSync(`${output}portrait-${String(index + 1).padStart(2, '0')}.svg`, svg)
}

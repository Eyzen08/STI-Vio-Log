// Run with the bundled Playwright package available through NODE_PATH.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { auditThemeColors } from './lib/themeAudit.mjs'

const { chromium, expect } = createRequire(import.meta.url)('playwright/test')
const output = fileURLToPath(new URL('../artifacts/message-inbox/', import.meta.url))
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="app-shell admin-portal" style="display:block;padding:16px"><main class="main-panel main-panel--messages" style="margin:0;width:100%"><div id="root" class="page-content"></div></main></div><script type="module">
  import React from 'react'
  import { createRoot } from 'react-dom/client'
  import MessagesPage from '/src/components/MessagesPage.jsx'
  import HandbookPage from '/src/components/HandbookPage.jsx'
  import StudentClearance from '/src/components/StudentClearance.jsx'
  import StudentViolations from '/src/components/StudentViolations.jsx'
  import '/src/index.css'
  import '/src/App.css'
  import '/src/styles/portal-system.css'
  import '/src/styles/portal-overrides.css'
  import '/src/styles/student-portal.css'
  const root = createRoot(document.getElementById('root'))
  window.showHandbook = () => { document.querySelector('.main-panel').classList.remove('main-panel--messages'); root.render(React.createElement(HandbookPage)) }
  window.showStudentPage = (kind, props) => {
    document.querySelector('.app-shell').className='app-shell student-portal'
    document.querySelector('.main-panel').classList.remove('main-panel--messages')
    root.render(React.createElement(kind==='clearance'?StudentClearance:StudentViolations,{token:'fixture-only',...props}))
  }
  const role = new URLSearchParams(location.search).get('role') || 'DISCIPLINE_ADMIN'
  if (role === 'STUDENT') document.querySelector('.app-shell').classList.replace('admin-portal', 'student-portal')
  const unread = count => {window.fixtureUnread=count}
  const isDeep = new URLSearchParams(location.search).has('deep')
  function FixtureApp() {
    const [search,setSearch] = React.useState(isDeep?'?conversation_id=1':'')
    return React.createElement(MessagesPage, {key:search, searchParams:search, token:'fixture-only', role, currentUser:{full_name:'QA Fixture'}, onUnreadChange:unread,
      onViewStudent:id=>{window.fixtureStudentTarget='/admin/students?student_id='+id},
      onOpenTarget:isDeep?id=>setSearch('?conversation_id='+id):undefined,
      onCloseTarget:isDeep?()=>{window.fixtureCloseCount=(window.fixtureCloseCount||0)+1;setSearch('')}:undefined})
  }
  root.render(React.createElement(FixtureApp))
</script></body></html>`
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: `${output}vite-cache`,
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{ name: 'message-inbox-fixture', configureServer(vite) {
    vite.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/__message-inbox.html')) return next()
      response.setHeader('Content-Type', 'text/html')
      response.end(await vite.transformIndexHtml(request.url, html))
    })
  } }]
})

const makeConversations = () => [
  { id:1, subject:'Service schedule', unread_count:2, latest_message_at:'2026-10-23T08:00:00Z' },
  { id:2, subject:'Clearance follow-up', unread_count:0, latest_message_at:'2026-10-24T08:00:00Z' },
  { id:3, subject:'Completed attendance review', status:'CLOSED', unread_count:0, latest_message_at:'2026-10-22T08:00:00Z' },
  { id:4, subject:'Archived reminder', unread_count:1, is_archived:true, latest_message_at:'2026-10-21T08:00:00Z' }
].map(item => ({ student_id:42, status:'OPEN', is_pinned:false, is_archived:false, is_deleted:false, student_name:'Juan Dela Cruz', student_number:'02000123456', school_participant:'Discipline Office', message_preview:'Please confirm the scheduled community service attendance.', ...item }))

async function fixture(page) {
  const state = { conversations:makeConversations(), requests:[], failNext:null, deferNext:false, releaseMutation:null }
  await page.addInitScript(()=>{
    window.fixtureEvents=[]
    const record=event=>{window.fixtureEvents.push({type:event.type,target:event.target?.getAttribute?.('aria-label')||event.target?.getAttribute?.('role')||event.target?.tagName,scrollY,rects:[...document.querySelectorAll('.conversation-actions-trigger')].map(button=>({label:button.getAttribute('aria-label'),top:button.getBoundingClientRect().top,left:button.getBoundingClientRect().left})),menus:document.querySelectorAll('[role="menu"]').length});window.fixtureEvents=window.fixtureEvents.slice(-15)}
    for(const type of ['scroll','resize','focusin','pointerdown','click']) window.addEventListener(type,record,true)
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const body = request.postData() ? JSON.parse(request.postData()) : {}
    state.requests.push({ method, path:url.pathname, query:Object.fromEntries(url.searchParams), body })
    const reply = (data, status = 200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) })
    if (url.pathname === '/api/student/clearance/certificates') return reply({certificates:[]})
    if (method !== 'GET' && state.deferNext) {
      state.deferNext = false
      await new Promise(resolve => {state.releaseMutation=()=>{state.releaseMutation=null;resolve()}})
    }
    if (method !== 'GET' && state.failNext) {
      const message = state.failNext
      state.failNext = null
      return reply({ message }, 500)
    }
    if (method === 'GET' && url.pathname === '/api/messages/conversations') {
      let items = state.conversations.filter(item => !item.is_deleted && item.is_archived === (url.searchParams.get('folder') === 'ARCHIVED'))
      if (url.searchParams.get('unread') === 'true') items = items.filter(item => item.unread_count > 0)
      if (url.searchParams.get('status') === 'CLOSED') items = items.filter(item => item.status === 'CLOSED')
      if (url.searchParams.get('search')) items = items.filter(item => item.subject.toLowerCase().includes(url.searchParams.get('search').toLowerCase()))
      items = [...items].sort((a,b) => Number(b.is_pinned)-Number(a.is_pinned) || b.latest_message_at.localeCompare(a.latest_message_at))
      return reply({ conversations:items, pagination:{page:1,pages:1,total:items.length}, unread_total:state.conversations.filter(item => !item.is_deleted).reduce((total,item) => total+item.unread_count,0) })
    }
    if (url.pathname === '/api/messages/recipients') return reply({ message:'Recipient lookup failed.' }, 503)
    const match = url.pathname.match(/^\/api\/messages\/conversations\/(\d+)(?:\/(read|preferences|status))?$/)
    assert.ok(match, `Unexpected API request: ${method} ${url.pathname}`)
    const conversation = state.conversations.find(item => item.id === Number(match[1]))
    assert.ok(conversation)
    if (method === 'GET') return reply({ conversation, messages:[{id:1, sender_name:'Discipline Office', message_text:'Please attend your assigned schedule.', created_at:'2026-10-24T08:00:00Z', sent_by_me:false}], pagination:{page:1,pages:1} })
    if (match[2] === 'read') conversation.unread_count = body.is_read === false ? 1 : 0
    else if (match[2] === 'preferences' || match[2] === 'status') Object.assign(conversation, body)
    else if (method === 'DELETE') conversation.is_deleted = true
    else assert.fail(`Unexpected mutation: ${method} ${url.pathname}`)
    return reply({ conversation, success:true })
  })
  return state
}

const row = (page, subject) => page.locator('.conversation-row').filter({ has:page.getByRole('button', {name:new RegExp(`Subject: ${subject}(?:,|$)`)}) })
const actionTrigger = (page, subject) => row(page,subject).getByRole('button',{name:`Actions for ${subject}`,exact:true})
async function action(page, subject, name) {
  await actionTrigger(page,subject).click()
  await expect(page.getByRole('menu', {name:`Conversation actions: ${subject}`,exact:true})).toBeVisible()
  await page.getByRole('menu', {name:`Conversation actions: ${subject}`,exact:true}).getByRole('menuitem',{name,exact:true}).click()
}
async function tab(page, name) {
  const response = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/messages/conversations')
  await page.getByRole('tab',{name:new RegExp(`^${name}(?:$|\\s)`)}).click()
  await response
  await expect(page.getByText('Loading conversations…')).toHaveCount(0)
}
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'page must fit the viewport')
let browser
const errors = []
try {
  await mkdir(output, { recursive:true })
  await server.listen()
  browser = await chromium.launch({ headless:true, channel:'chrome' })
  const page = await browser.newPage({viewport:{width:1440,height:1000},bypassCSP:true})
  page.on('pageerror', error => errors.push(error.message))
  const state = await fixture(page)
  await page.goto(server.resolvedUrls.local[0]+'__message-inbox.html',{waitUntil:'domcontentloaded'})
  const subject = 'Service schedule'
  await expect(page.locator('.conversation-row')).toHaveCount(3)
  console.log('Fixture loaded; checking keyboard and outside dismissal.')
  const trigger = actionTrigger(page,subject)
  await page.mouse.move(0,0)
  const restingBounds = await trigger.boundingBox()
  await trigger.hover()
  await page.waitForTimeout(220)
  await page.screenshot({path:output+'dots-hover.png'})
  const hoverBounds = await trigger.boundingBox()
  assert.ok(Math.abs(restingBounds.y-hoverBounds.y)<1, 'Three-dot button must not move on hover')
  await page.mouse.down()
  await page.waitForTimeout(220)
  assert.ok(Math.abs(restingBounds.y-(await trigger.boundingBox()).y)<1, 'Three-dot button must not move on press')
  await page.mouse.up()
  await page.keyboard.press('Escape')
  await trigger.focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu',{name:`Conversation actions: ${subject}`,exact:true})
  await expect(menu.getByRole('menuitem',{name:'Mark as read',exact:true})).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(menu.getByRole('menuitem',{name:'Delete',exact:true})).toBeFocused()
  await page.keyboard.press('Home')
  await expect(menu.getByRole('menuitem',{name:'Mark as read',exact:true})).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem',{name:'Pin',exact:true})).toBeFocused()
  await page.keyboard.press('End')
  await expect(menu.getByRole('menuitem',{name:'Delete',exact:true})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await action(page,subject,'View Student')
  assert.equal(await page.evaluate(()=>window.fixtureStudentTarget),'/admin/students?student_id=42')
  await trigger.click()
  await page.getByRole('searchbox',{name:'Search Conversations'}).click()
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('searchbox',{name:'Search Conversations'})).toBeFocused()
  await trigger.click()
  await page.getByRole('button',{name:'New Message',exact:true}).focus()
  await expect(menu).toHaveCount(0)
  console.log('Menu keyboard/focus checks passed; checking mutations.')
  await action(page,subject,'Pin')
  await expect(page.locator('.conversation-row').first()).toContainText(subject)
  await expect(row(page,subject).getByText('Pinned',{exact:true})).toBeVisible()
  await expect(row(page,subject).locator('.conversation-pinned svg')).toBeVisible()
  await action(page,subject,'Unpin')
  await expect(row(page,subject).locator('.conversation-pinned')).toHaveCount(0)
  await expect(page.locator('.conversation-row').first()).toContainText('Clearance follow-up')
  await action(page,subject,'Mark as read')
  await expect(row(page,subject).locator('.conversation-open')).not.toHaveClass(/unread/)
  await expect.poll(() => page.evaluate(() => window.fixtureUnread)).toBe(1)
  await action(page,subject,'Mark as unread')
  await expect(row(page,subject).locator('.conversation-open')).toHaveClass(/unread/)
  await expect.poll(() => page.evaluate(() => window.fixtureUnread)).toBe(2)
  assert.equal(state.requests.some(request => /\/conversations\/\d+$/.test(request.path)),false,'row actions must not fetch/open a thread')
  await tab(page,'Unread')
  await expect(page.locator('.conversation-row')).toHaveCount(1)
  assert.equal(state.requests.at(-1).query.unread,'true')
  await tab(page,'Closed')
  await expect(page.locator('.conversation-row')).toHaveCount(1)
  await expect(page.locator('.conversation-row')).toContainText('Completed attendance review')
  await expect.poll(() => page.evaluate(() => window.fixtureUnread)).toBe(2)
  await tab(page,'All')
  await action(page,subject,'Archive')
  await expect(row(page,subject)).toHaveCount(0)
  await tab(page,'Archived')
  assert.equal(state.requests.at(-1).query.folder,'ARCHIVED')
  await expect(page.locator('.conversation-row')).toHaveCount(2)
  await action(page,subject,'Unarchive')
  await expect(row(page,subject)).toHaveCount(0)
  await tab(page,'All')
  await expect(row(page,subject)).toBeVisible()
  await action(page,'Clearance follow-up','Delete')
  const dialog = page.getByRole('dialog',{name:'Delete Conversation',exact:true})
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Other participants and school records keep their copy.')
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  assert.equal(state.requests.some(request => request.method === 'DELETE'),false,'cancel must not delete')
  await expect(actionTrigger(page,'Clearance follow-up')).toBeFocused()
  await action(page,'Clearance follow-up','Delete')
  await dialog.getByRole('button',{name:'Delete Conversation',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(row(page,'Clearance follow-up')).toHaveCount(0)
  for (const [name,message] of [['Mark as read','Read update failed.'],['Pin','Pin update failed.'],['Delete','Delete update failed.']]) {
    state.failNext = message
    await action(page,subject,name)
    if (name === 'Delete') await dialog.getByRole('button',{name:'Delete Conversation',exact:true}).click()
    await expect(page.getByRole('alert')).toHaveText(message)
    await expect(row(page,subject)).toBeVisible()
    assert.equal(state.conversations[0].is_pinned,false)
    assert.equal(state.conversations[0].unread_count,1)
    if (name === 'Delete') await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
  }
  await row(page,subject).locator('.conversation-open').click()
  await expect(page.getByText('Please attend your assigned schedule.',{exact:true})).toBeVisible()
  const header = page.locator('.chat-header')
  await header.getByRole('button',{name:`Actions for ${subject}`,exact:true}).click()
  await menu.getByRole('menuitem',{name:'Mark as unread',exact:true}).click()
  await expect(page.getByText('Select a Conversation',{exact:true})).toBeVisible()
  await expect(row(page,subject).locator('.conversation-open')).toHaveClass(/unread/)
  await page.close()
  console.log('Inbox action and error checks passed; checking responsive screens and handbook.')

  const deep = await browser.newPage({viewport:{width:1280,height:1000},bypassCSP:true})
  deep.on('pageerror', error => errors.push(error.message))
  const deepState = await fixture(deep)
  await deep.goto(server.resolvedUrls.local[0]+'__message-inbox.html?deep=1',{waitUntil:'domcontentloaded'})
  await expect(deep.getByText('Please attend your assigned schedule.',{exact:true})).toBeVisible()
  await expect(row(deep,subject).locator('.conversation-open')).not.toHaveClass(/unread/)
  for (const name of ['Mark as unread','Archive','Delete']) {
    if (!await deep.locator('.chat-header').count()) {
      await row(deep,subject).locator('.conversation-open').click()
      await expect(deep.getByText('Please attend your assigned schedule.',{exact:true})).toBeVisible()
      await expect(row(deep,subject).locator('.conversation-open')).not.toHaveClass(/unread/)
    }
    await deep.locator('.chat-header').getByRole('button',{name:`Actions for ${subject}`,exact:true}).click()
    deepState.failNext = `Deep link ${name} failed.`
    deepState.deferNext = true
    await deep.getByRole('menuitem',{name,exact:true}).click()
    if (name === 'Delete') await deep.getByRole('dialog').getByRole('button',{name:'Delete Conversation',exact:true}).click()
    await expect.poll(()=>typeof deepState.releaseMutation).toBe('function')
    assert.equal(await deep.evaluate(()=>window.fixtureCloseCount||0),0,'deep-link route must stay mounted while mutation is pending')
    deepState.releaseMutation()
    await expect(deep.getByRole('alert')).toHaveText(`Deep link ${name} failed.`)
    assert.equal(await deep.evaluate(()=>window.fixtureCloseCount||0),0,'failed mutation must retain its error without route remount')
    if (name === 'Delete') await deep.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click()
  }
  await row(deep,subject).locator('.conversation-open').click()
  await expect(deep.getByText('Please attend your assigned schedule.',{exact:true})).toBeVisible()
  await expect(row(deep,subject).locator('.conversation-open')).not.toHaveClass(/unread/)
  deepState.deferNext = true
  await deep.locator('.chat-header').getByRole('button',{name:`Actions for ${subject}`,exact:true}).click()
  await deep.getByRole('menuitem',{name:'Archive',exact:true}).click()
  await expect.poll(()=>typeof deepState.releaseMutation).toBe('function')
  assert.equal(await deep.evaluate(()=>window.fixtureCloseCount||0),0)
  deepState.releaseMutation()
  await expect.poll(()=>deep.evaluate(()=>window.fixtureCloseCount||0)).toBe(1)
  await expect(row(deep,subject)).toHaveCount(0)
  await deep.close()
  console.log('Deep-link pending/failure/success route-remount checks passed.')

  const race = await browser.newPage({viewport:{width:1280,height:1000},bypassCSP:true})
  race.on('pageerror', error => errors.push(error.message))
  const raceState = await fixture(race)
  await race.goto(server.resolvedUrls.local[0]+'__message-inbox.html?deep=1',{waitUntil:'domcontentloaded'})
  await expect(row(race,subject).locator('.conversation-open')).not.toHaveClass(/unread/)
  await race.locator('.chat-header').getByRole('button',{name:`Actions for ${subject}`,exact:true}).click()
  raceState.deferNext = true
  await race.getByRole('menuitem',{name:'Archive',exact:true}).click()
  await expect.poll(()=>typeof raceState.releaseMutation).toBe('function')
  await row(race,'Clearance follow-up').locator('.conversation-open').click()
  const nextHeader = race.locator('.chat-header').getByRole('button',{name:'Actions for Clearance follow-up',exact:true})
  await expect(nextHeader).toBeEnabled()
  const oldRefresh = race.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/messages/conversations')
  raceState.releaseMutation()
  await oldRefresh
  await race.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  assert.equal(await race.evaluate(()=>window.fixtureCloseCount||0),0,'completed old action must not close the newly opened route')
  await expect(nextHeader).toBeVisible()
  await race.close()
  console.log('Navigating to another thread during a pending action preserves the new route.')

  for (const width of [390,768,1280]) for (const theme of ['light','dark']) {
    const screen = await browser.newPage({viewport:{width,height:1000},bypassCSP:true})
    screen.on('pageerror', error => errors.push(error.message))
    await fixture(screen)
    await screen.addInitScript(value => {document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.theme=value})},theme)
    await screen.goto(server.resolvedUrls.local[0]+`__message-inbox.html?role=${width===390?'STUDENT':'DISCIPLINE_ADMIN'}`,{waitUntil:'domcontentloaded'})
    await expect(screen.locator('.conversation-row')).toHaveCount(3)
    await actionTrigger(screen,subject).click()
    await expect(screen.getByRole('menu')).toBeVisible()
    const bounds = await screen.getByRole('menu').boundingBox()
    assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width && bounds.y>=0 && bounds.y+bounds.height<=1000,'menu must remain within viewport')
    await noOverflow(screen)
    await screen.screenshot({path:output+`${theme}-${width}-inbox.png`})
    await screen.keyboard.press('Escape')
    await row(screen,subject).locator('.conversation-open').click()
    await expect(screen.getByText('Please attend your assigned schedule.',{exact:true})).toBeVisible()
    await noOverflow(screen)
    await screen.locator('.chat-header').getByRole('button',{name:`Actions for ${subject}`,exact:true}).click()
    assert.deepEqual((await screen.evaluate(auditThemeColors)).findings, [], `${theme} ${width}: message colors`)
    await screen.screenshot({path:output+`${theme}-${width}-thread.png`})
    await screen.keyboard.press('Escape')
    await screen.evaluate(()=>window.showHandbook())
    await expect(screen.getByRole('heading',{name:'STI Handbook',exact:true})).toBeVisible()
    await expect(screen.locator('iframe')).toHaveCount(1)
    const liveLink = screen.getByRole('link',{name:/Open STI’s Live Handbook/})
    assert.ok((await liveLink.boundingBox()).y < (await screen.locator('.handbook-library').boundingBox()).y)
    for (const link of [liveLink,screen.getByRole('link',{name:/^Open PDF/}),screen.getByRole('link',{name:'Download PDF',exact:true})]) {
      const box = await link.boundingBox()
      assert.ok(box.height>=44 && box.width>=44,'Handbook links must be comfortably sized')
    }
    const primaryColors = await screen.locator('.handbook-open-pdf').evaluate(el=>{
      const sample=document.createElement('span');sample.style.setProperty('background-color','var(--action-primary-surface)','important');sample.style.setProperty('color','var(--text-on-accent)','important');el.append(sample)
      const actual=getComputedStyle(el),expected=getComputedStyle(sample)
      const colors={actual:{background:actual.backgroundColor,color:actual.color},expected:{background:expected.backgroundColor,color:expected.color}}
      sample.remove();return colors
    })
    assert.deepEqual(primaryColors.actual,primaryColors.expected,'Open PDF must use the filled primary action colors')
    await expect.poll(async () => (await screen.evaluate(auditThemeColors)).findings).toEqual([])
    for (const [label,file] of [['Complete Tertiary Handbook','sti-tertiary-handbook'],['Offenses','sti-offenses'],['Disciplinary Measures','sti-disciplinary-measures'],['Student Discipline','sti-student-discipline']]) {
      const choice = screen.getByRole('button',{name:new RegExp(`^${label}`)})
      await choice.focus()
      await screen.keyboard.press('Enter')
      await expect(choice).toHaveAttribute('aria-pressed','true')
      await expect(screen.locator('iframe')).toHaveAttribute('src',`/handbook/${file}-july-2026.pdf`)
      await expect(screen.locator('iframe')).toHaveAttribute('title',`${label} PDF reader`)
      await expect(screen.getByRole('link',{name:'Open PDF (new tab)',exact:true})).toHaveAttribute('href',`/handbook/${file}-july-2026.pdf`)
      await expect(screen.getByRole('link',{name:'Download PDF',exact:true})).toHaveAttribute('href',`/handbook/${file}-july-2026.pdf`)
    }
    const popupPromise = screen.waitForEvent('popup')
    await screen.getByRole('link',{name:'Open PDF (new tab)',exact:true}).click()
    const popup = await popupPromise
    assert.ok(popup.url().endsWith('/handbook/sti-student-discipline-july-2026.pdf'))
    await popup.close()
    const downloadPromise = screen.waitForEvent('download')
    await screen.getByRole('link',{name:'Download PDF',exact:true}).click()
    assert.equal((await downloadPromise).suggestedFilename(),'sti-student-discipline-july-2026.pdf')
    await noOverflow(screen)
    await screen.screenshot({path:output+`${theme}-${width}-handbook.png`,fullPage:true})
    for (const [status,eligible] of [['NOT_ELIGIBLE',false],['PENDING',true],['CLEARED',true]]) {
      await screen.evaluate(({status,eligible})=>window.showStudentPage('clearance',{eligibility:{eligible,hasActiveViolation:!eligible,hasPendingService:!eligible},records:[{id:1,status}]}),{status,eligible})
      await expect(screen.locator('.student-clearance-status')).toBeVisible()
      if (!eligible) assert.equal(await screen.locator('.clearance-requirements ul').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Requirements must use a neutral surface')
      await expect.poll(async () => (await screen.evaluate(auditThemeColors)).findings).toEqual([])
      await noOverflow(screen)
      await screen.screenshot({path:output+`${theme}-${width}-clearance-${status}.png`,fullPage:true})
    }
    await screen.evaluate(()=>window.showStudentPage('violations',{violations:[{id:1,status:'OPEN',severity:'MINOR',exact_offense:'Uniform requirement',incident_date:'2026-10-24',required_service_hours:4,remaining_service_hours:2,history:[]}]}))
    await expect(screen.locator('.violation-card')).toBeVisible()
    await screen.locator('.violation-summary').click()
    await expect(screen.locator('.violation-details')).toBeVisible()
    if (theme==='dark') assert.ok(await screen.locator('.violations-page :is(.page-intro,.violation-card,.violation-details,.service-progress)').evaluateAll(elements=>elements.every(el=>getComputedStyle(el).boxShadow==='none')),'Dark student violations must have no decorative shadows')
    await expect.poll(async () => (await screen.evaluate(auditThemeColors)).findings).toEqual([])
    await screen.screenshot({path:output+`${theme}-${width}-violations.png`,fullPage:true})
    for (const props of [{violations:[]},{violations:[],error:'Records unavailable.'},{violations:[],loading:true}]) {
      await screen.evaluate(props=>window.showStudentPage('violations',props),props)
      await noOverflow(screen)
    }
    for (const props of [{loading:true},{eligibility:{eligible:false},error:'Clearance unavailable.'}]) {
      await screen.evaluate(props=>window.showStudentPage('clearance',props),props)
      await noOverflow(screen)
    }
    await screen.close()
  }
  for (const role of ['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE','DEPARTMENT_HEAD','STUDENT']) {
    const screen = await browser.newPage({viewport:{width:390,height:600},bypassCSP:true,reducedMotion:'reduce'})
    const roleState = await fixture(screen)
    await screen.goto(server.resolvedUrls.local[0]+`__message-inbox.html?role=${role}`)
    await expect(screen.locator('.conversation-row')).toHaveCount(3)
    const allowed = ['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE'].includes(role)
    for (const location of ['list','thread']) {
      if (location==='thread') await row(screen,subject).locator('.conversation-open').click()
      const trigger = location==='list'?actionTrigger(screen,subject):screen.locator('.chat-header .conversation-actions-trigger')
      await trigger.scrollIntoViewIfNeeded()
      await screen.evaluate(()=>document.fonts.ready)
      await screen.mouse.move(0,0)
      const rest = await trigger.boundingBox()
      await trigger.hover()
      await screen.waitForTimeout(220)
      assert.ok(Math.abs((await trigger.boundingBox()).y-rest.y)<1,`${role} ${location}: stable hover ${JSON.stringify({rest,hover:await trigger.boundingBox()})}`)
      await trigger.focus()
      await screen.keyboard.press('Enter')
      const menu = screen.getByRole('menu')
      await expect(menu.getByRole('menuitem',{name:'View Student',exact:true})).toHaveCount(allowed?1:0)
      const box = await menu.boundingBox()
      assert.ok(box.x>=8 && box.x+box.width<=382 && box.y>=8 && box.y+box.height<=592,'Measured menu must fit a short mobile viewport')
      if (allowed) {
        await menu.getByRole('menuitem',{name:'View Student',exact:true}).click()
        assert.equal(await screen.evaluate(()=>window.fixtureStudentTarget),'/admin/students?student_id=42')
      } else await screen.keyboard.press('Escape')
    }
    delete roleState.conversations[0].student_id
    await screen.reload()
    await actionTrigger(screen,subject).click()
    await expect(screen.getByRole('menuitem',{name:'View Student',exact:true})).toHaveCount(0)
    await screen.close()
  }
  const errorPage = await browser.newPage({viewport:{width:1280,height:900},bypassCSP:true})
  await fixture(errorPage)
  await errorPage.goto(server.resolvedUrls.local[0]+'__message-inbox.html')
  await errorPage.evaluate(() => { document.documentElement.dataset.theme='dark' })
  await errorPage.getByRole('button',{name:'New Message',exact:true}).click()
  await errorPage.getByRole('combobox').fill('Juan')
  await expect(errorPage.getByText('Recipient lookup failed.',{exact:true})).toBeVisible()
  assert.equal(await errorPage.locator('.recipient-search-error').evaluate(element => getComputedStyle(element).color), 'rgb(255, 155, 167)', 'Recipient lookup errors retain their danger role inside a portal modal')
  await errorPage.close()
  assert.deepEqual(errors,[])
  console.log('Verified inbox menu keyboard/focus/dismissal, row isolation, pin icons/ordering, read/unread/global badge, filters, archive/unarchive, delete cancel/success, mutation errors, thread menu; desktop/mobile light/dark no overflow. Handbook choices, reader, PDF popup/download verified. Screenshots: '+output)
} catch (error) {
  for (const [index,page] of (browser?.contexts().flatMap(context=>context.pages()) || []).entries()) {
    await page.screenshot({path:output+`failure-${index}.png`,fullPage:true}).catch(()=>{})
    console.error(JSON.stringify(await page.evaluate(()=>({active:document.activeElement?.tagName,events:window.fixtureEvents,menus:[...document.querySelectorAll('[role="menu"]')].map(menu=>menu.outerHTML),errors:[...document.querySelectorAll('[role="alert"]')].map(alert=>alert.textContent)})).catch(()=>null)))
  }
  throw error
} finally {
  await browser?.close()
  await server.close()
}

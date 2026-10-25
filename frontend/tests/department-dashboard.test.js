import test from 'node:test'
import assert from 'node:assert/strict'

import { formatDuration, summarizeDepartmentDtr } from '../src/lib/departmentDashboard.js'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'

test('department overview shows the four latest active sessions and separates unavailable from empty', async () => {
  const server = await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,plugins:[react()],server:{middlewareMode:true,hmr:false}})
  try {
    const {default:Dashboard}=await server.ssrLoadModule('/src/components/DepartmentDashboard.jsx')
    const activeSessions=Array.from({length:6},(_,i)=>({session_id:i+1,student_id:i+1,first_name:`Student${i+1}`,last_name:'Test',student_number:`0200000000${i}`,status:'ACTIVE',time_in:`2026-10-25T0${i}:00:00Z`}))
    activeSessions.push({...activeSessions[0],session_id:7,first_name:'Finished',status:'COMPLETED',time_out:'2026-10-25T07:00:00Z'})
    const render=props=>renderToStaticMarkup(createElement(Dashboard,{report:{data:[]},...props}))
    const html=render({attendanceReady:true,activeSessions})
    assert.match(html,/Current Attendance/)
    const current=html.slice(html.indexOf('Current Attendance'),html.indexOf('Recent Attendance'))
    assert.ok(current.indexOf('Student6')<current.indexOf('Student5'))
    assert.equal((current.match(/Student[1-6]/g)||[]).length,4)
    assert.doesNotMatch(current,/Student1|Student2|Finished/)
    assert.match(html,/department-dashboard-side/)
    assert.match(render({attendanceReady:true}),/No Students Currently Timed In/)
    assert.match(render({attendanceReady:false}),/Current attendance unavailable/)
  } finally {await server.close()}
})

test('department dashboard summarizes scoped DTR rows without double-counting students', () => {
  const summary = summarizeDepartmentDtr({
    totals: { completed_sessions: 5, worked_minutes: 330, credited_minutes: 300 },
    data: [
      { student_id: 4, assignment_status: 'IN_PROGRESS', remaining_hours: '1.5' },
      { student_id: 4, assignment_status: 'COMPLETED', remaining_hours: 0 },
      { student_id: 8, assignment_status: 'OPEN', remaining_hours: 2 }
    ]
  })

  assert.deepEqual(summary, {
    studentsServed: 2,
    activeAssignments: 2,
    completedSessions: 5,
    workedMinutes: 330,
    creditedMinutes: 300
  })
})

test('department duration values are displayed consistently', () => {
  assert.equal(formatDuration(0), '0m')
  assert.equal(formatDuration(45), '45m')
  assert.equal(formatDuration(60), '1h')
  assert.equal(formatDuration(135), '2h 15m')
})

test('department dashboard tolerates the empty report used during login routing', () => {
  assert.deepEqual(summarizeDepartmentDtr(null), {
    studentsServed: 0,
    activeAssignments: 0,
    completedSessions: 0,
    workedMinutes: 0,
    creditedMinutes: 0
  })
})

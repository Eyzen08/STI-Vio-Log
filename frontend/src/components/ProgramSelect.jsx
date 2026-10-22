import { COLLEGE_PROGRAMS, TESDA_PROGRAMS, formatProgramCode } from '../lib/programNames.js'

export default function ProgramSelect({ value, onChange, academicLevel = 'COLLEGE', name = 'program', required = false, disabled = false, includeBlank = true }) {
  const programs = academicLevel === 'TESDA' ? TESDA_PROGRAMS : COLLEGE_PROGRAMS
  return <select name={name} value={value || ''} onChange={onChange} required={required} disabled={disabled}>
    {includeBlank && <option value="">Select a Program</option>}
    {Object.entries(programs).map(([code, label]) => <option key={code} value={code}>{formatProgramCode(code)} — {label}</option>)}
  </select>
}

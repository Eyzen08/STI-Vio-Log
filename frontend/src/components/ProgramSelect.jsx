import { PROGRAM_NAMES } from '../lib/programNames.js'

export default function ProgramSelect({ value, onChange, name = 'program', required = false, disabled = false, includeBlank = true }) {
  return <select name={name} value={value || ''} onChange={onChange} required={required} disabled={disabled}>
    {includeBlank && <option value="">Select program</option>}
    {Object.entries(PROGRAM_NAMES).map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}
  </select>
}

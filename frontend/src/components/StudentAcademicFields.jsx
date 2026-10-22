import ProgramSelect from './ProgramSelect.jsx'
import { ACADEMIC_LEVELS, STRANDS, academicYear, yearOptions, changedAcademicMode } from '../lib/studentAcademic.js'
export default function StudentAcademicFields({ value, onChange, required = true, legacy = false }) {
 const shs = value.academic_level === 'SENIOR_HIGH_SCHOOL'
 const years = yearOptions(value.academic_level)
 const olderYear = legacy && value.year_level && !years.some(([year]) => String(year) === String(value.year_level))
 return <>
  <label>Academic Level<select name="academic_level" value={value.academic_level || ''} onChange={event => onChange(changedAcademicMode(event.target.value))} required={required}><option value="">{legacy ? 'Not Recorded' : 'Select Academic Level'}</option>{ACADEMIC_LEVELS.map(([code,name]) => <option key={code} value={code}>{name}</option>)}</select></label>
  {shs ? <label>Strand<select name="strand" value={value.strand || ''} onChange={event => onChange({strand:event.target.value})} required={required}><option value="">{legacy ? 'Not Recorded' : 'Select a Strand'}</option>{STRANDS.map(([code,name]) => <option key={code} value={code}>{code} - {name}</option>)}</select></label> : <label>Program<ProgramSelect academicLevel={value.academic_level} value={value.program || ''} onChange={event => onChange({program:event.target.value})} required={required}/></label>}
  <label>Section<input name="section" value={value.section || ''} onChange={event => onChange({section:event.target.value})} maxLength="100" required={required} placeholder={shs?'e.g. STEM123':'e.g. A103'}/></label>
  {value.academic_level !== 'TESDA' && <label>{shs ? 'Grade Level' : 'Year Level'}<select name="year_level" value={value.year_level || ''} onChange={event => onChange({year_level:event.target.value})} required={required}><option value="">Select {shs ? 'Grade' : 'Year'} Level</option>{olderYear && <option value={value.year_level}>{academicYear(value)}</option>}{years.map(([year,label]) => <option key={year} value={year}>{label}</option>)}</select></label>}
 </>
}

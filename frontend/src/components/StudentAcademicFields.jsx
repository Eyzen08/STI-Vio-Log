import ProgramSelect from './ProgramSelect.jsx'
import { STRANDS, yearOptions } from '../lib/studentAcademic.js'
export default function StudentAcademicFields({ value, onChange, required = true, legacy = false }) {
 const shs = value.academic_level === 'SENIOR_HIGH_SCHOOL'
 const years = yearOptions(value.academic_level)
 const olderYear = legacy && value.year_level && !years.some(([year]) => String(year) === String(value.year_level))
 return <>
  <label>Academic level<select name="academic_level" value={value.academic_level || ''} onChange={event => onChange({academic_level:event.target.value,program:'',strand:'',year_level:''})} required={required}><option value="">Not recorded</option><option value="COLLEGE">College</option><option value="SENIOR_HIGH_SCHOOL">Senior High School</option></select></label>
  {shs ? <label>Strand<select name="strand" value={value.strand || ''} onChange={event => onChange({strand:event.target.value})} required={required}><option value="">{legacy ? 'Not recorded' : 'Select strand'}</option>{STRANDS.map(([code,name]) => <option key={code} value={code}>{code} - {name}</option>)}</select></label> : <label>Program<ProgramSelect value={value.program || ''} onChange={event => onChange({program:event.target.value})} required={required}/></label>}
  <label>Section<input name="section" value={value.section || ''} onChange={event => onChange({section:event.target.value})} maxLength="100" required={required}/></label>
  <label>{shs ? 'Grade level' : 'Year level'}<select name="year_level" value={value.year_level || ''} onChange={event => onChange({year_level:event.target.value})} required={required}><option value="">Select {shs ? 'grade' : 'year'} level</option>{olderYear && <option value={value.year_level}>Recorded year {value.year_level}</option>}{years.map(([year,label]) => <option key={year} value={year}>{label}</option>)}</select></label>
 </>
}

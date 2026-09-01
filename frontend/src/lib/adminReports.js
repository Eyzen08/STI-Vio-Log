const SORTS = {
  violations: ['date_desc','date_asc','status'],
  'community-service': ['hours_desc','hours_asc','status'],
  dtr: [],
  'non-compliance': ['date','hours','violations'],
  'parent-contacts': ['date_desc','date_asc'],
  clearance: ['date_desc','date_asc','status'],
  'good-standing': ['student_number','name']
}

export const reportSortOptions = (type) => SORTS[type] || []

export const buildAdminReportQuery = (type, filters = {}) => {
  const params = new URLSearchParams()
  const add = (key,value) => { if (String(value ?? '').trim()) params.set(key,String(value).trim()) }
  if (['violations','community-service','clearance'].includes(type)) add('status',filters.status)
  if (type !== 'non-compliance') add('student_id',filters.student_id)
  if (['violations','parent-contacts'].includes(type)) { add('from_date',filters.from_date);add('to_date',filters.to_date) }
  if (type === 'dtr') { add('from',filters.from_date);add('to',filters.to_date) }
  const validSorts=reportSortOptions(type)
  if(validSorts.includes(filters.sort_by))add('sort_by',filters.sort_by)
  return params.toString()
}

export const defaultReportSort = (type) => reportSortOptions(type)[0] || ''

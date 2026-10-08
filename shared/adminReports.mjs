const SORTS = {
  violations: ['date_desc','date_asc','status'],
  'community-service': ['hours_desc','hours_asc','status'],
  dtr: [],
  'non-compliance': ['date','hours','violations'],
  'parent-contacts': ['date_desc','date_asc'],
  clearance: ['date_desc','date_asc','status'],
  'good-standing': ['student_number','name']
}

const FILTERS = {
  violations:['search','student_id','status','sort_by','from_date','to_date'],
  'community-service':['student_id','status','sort_by'],dtr:['student_id','from_date','to_date'],
  'non-compliance':['sort_by'],'parent-contacts':['student_id','sort_by','from_date','to_date'],
  clearance:['student_id','status','sort_by'],'good-standing':['student_id','sort_by']
}
export const reportFilterFields = type => Object.hasOwn(FILTERS,type) ? FILTERS[type] : []
export const reportStatusOptions = type => type==='clearance' ? ['NOT_ELIGIBLE','PENDING','CLEARED'] : type==='violations' ? ['OPEN','COMPLETE','CLEAR','INVALID_CANCEL'] : type==='community-service' ? ['OPEN','IN_PROGRESS','COMPLETED','CLEARED','ADMIN_CLOSED','INVALID_CANCELLED'] : []
export const reportSortLabel = sort => ({date_desc:'Newest first',date_asc:'Oldest first',status:'Status',hours_desc:'Most remaining time',hours_asc:'Least remaining time',date:'Latest violation',hours:'Most pending service',violations:'Most open violations',student_number:'Student number',name:'Student name'})[sort] || sort
export const validReportDate = value => {
  const date = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value
}
export const validateReportFilters = (type, filters={}) => {
  if(!reportFilterFields(type).includes('from_date'))return ''
  for(const key of ['from_date','to_date']) {
    const value=filters[key]; if(!value)continue
    if(!validReportDate(value))return 'Enter a valid calendar date.'
  }
  return filters.from_date&&filters.to_date&&filters.from_date>filters.to_date ? 'Choose an end date on or after the start date.' : ''
}

export const reportSortOptions = (type) => SORTS[type] || []

export const buildAdminReportQuery = (type, filters = {}) => {
  const params = new URLSearchParams()
  const add = (key,value) => { if (String(value ?? '').trim()) params.set(key,String(value).trim()) }
  if (['violations','community-service','clearance'].includes(type)) add('status',filters.status)
  if (type === 'violations') add('search', filters.search)
  if (type !== 'non-compliance') add('student_id',filters.student_id)
  if (['violations','parent-contacts'].includes(type)) { add('from_date',filters.from_date);add('to_date',filters.to_date) }
  if (type === 'dtr') { add('from',filters.from_date);add('to',filters.to_date) }
  const validSorts=reportSortOptions(type)
  if(validSorts.includes(filters.sort_by))add('sort_by',filters.sort_by)
  return params.toString()
}

export const defaultReportSort = (type) => reportSortOptions(type)[0] || ''

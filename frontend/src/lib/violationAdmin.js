export const HANDBOOK_OFFENSES = {
  HANDBOOK_MINOR: [
    'Non-adherence to STI Student Decorum', 'Discourtesy toward the STI community or campus visitors',
    'Non-wearing, incomplete, or improper use of school uniform or ID', 'Wearing inappropriate campus attire',
    'Losing or forgetting an ID three times', 'Disrespect to national symbols or a similar infraction',
    'Irresponsible or improper use of school property', 'Gambling on school premises or during official functions',
    'Staying or eating inside a classroom without permission', 'Disruption of classes, activities, peace, or order',
    'Display of affection that negatively affects the individuals reputation', 'Violation of classroom, laboratory, library, or office procedure',
    'Possession of cigarettes or vapes', 'Bringing pets onto school premises'
  ],
  HANDBOOK_MAJOR_A: [
    'More than three commissions of any minor offense', 'Lending, borrowing, wearing, or using a tampered school ID',
    'Smoking or vaping inside the campus', 'Entering intoxicated or bringing or drinking liquor inside the campus',
    'Allowing a non-STI individual to enter without official business', 'Cheating, unauthorized resources, plagiarism, prohibited communication, impersonation, or commissioned academic work'
  ],
  HANDBOOK_MAJOR_B: [
    'Vandalizing, damaging, or destroying property', 'Posting content disrespectful to STI or another person',
    'Recording or uploading content that violates another persons data privacy', 'Going to a place of ill repute while wearing the school uniform',
    'Giving false testimony during an official investigation', 'Using profane language that gravely insults a member of the STI community'
  ],
  HANDBOOK_MAJOR_C: [
    'Hacking a school or other institution computer system', 'Stealing, tampering with, or forging records or receipts',
    'Theft or robbery of property', 'Embezzlement or malversation of school or organization funds or property',
    'Disrupting academic functions through illegal assemblies or related public disorder', 'Act of immorality',
    'Bullying, including physical, cyber, or verbal bullying', 'Participation in brawls or infliction of physical injuries',
    'Physical assault', 'Failure or refusal to comply with mandatory random drug testing',
    'False or malicious fire alarm or bomb threat', 'Unjustified use of fire-protection or firefighting equipment'
  ],
  HANDBOOK_MAJOR_D: [
    'Unlawful involvement with prohibited drugs, controlled substances, or related chemicals', 'Refusal of confirmatory drug procedures or failure to follow the intervention program',
    'Carrying or possessing firearms, deadly weapons, or explosives', 'Membership in an organization that employs or advocates illegal rites or hazing',
    'Participation in illegal rites, initiation, or hazing', 'Crime involving moral turpitude or gross misconduct',
    'Sexual harassment', 'Extortion, blackmail, bribery, or coercion',
    'Subversion, sedition, or insurgency', 'Unauthorized copying, distribution, modification, or exhibition of eLMS or learning materials',
    'Unauthorized possession or removal of examination questionnaires', 'Use of a device to capture examination materials or activities'
  ]
}

export const offensesForType = (type) => {
  const offenses = type ? HANDBOOK_OFFENSES[type.violation_code] : null
  return offenses ? [...offenses, 'Other offense for Discipline Committee review'] : []
}

export const buildViolationDescription = (form = {}) =>
  `Handbook offense: ${String(form.exact_offense || '').trim()}\nIncident details: ${String(form.incident_details || '').trim()}`

export const buildViolationPayload = (form = {}) => ({
  student_id: Number(form.student_id),
  violation_type_id: Number(form.violation_type_id),
  incident_date: form.incident_date || new Date().toISOString().slice(0, 10),
  description: buildViolationDescription(form)
})

export const selectedViolationType = (types = [], id) =>
  types.find((type) => Number(type.id) === Number(id)) || null

export const studentOptionLabel = (student = {}) =>
  `${student.student_number || ''} - ${student.first_name || ''} ${student.last_name || ''}`.trim()

export const studentIdFromSearch = (students = [], search = '') => {
  const normalized = String(search).trim().toLocaleLowerCase()
  const match = students.find((student) => studentOptionLabel(student).toLocaleLowerCase() === normalized)
  return match ? Number(match.id) : ''
}

export const buildViolationUpdatePayload = (form = {}) => ({
  description: String(form.description || '').trim(),
  reason: String(form.reason || '').trim()
})

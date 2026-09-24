const USER_KEY = 'sti_vio_log_user'
const CSRF_KEY = 'sti_vio_log_csrf'
const DISPLAY_FIELDS = ['id','username','role','first_name','last_name','full_name','department_id','department_name','department_code','password_change_required','onboarding_required','onboarding_completed_at','onboarding_step','google_onboarding_stage','onboarding_google_email']
const displayUser = (user) => Object.fromEntries(DISPLAY_FIELDS.filter((field) => user?.[field] !== undefined).map((field) => [field, user[field]]))

export const clearSession = () => {
  localStorage.removeItem('sti_vio_log_token')
  localStorage.removeItem(USER_KEY)
  globalThis.sessionStorage?.removeItem(CSRF_KEY)
}

export const loadSession = () => {
  const storedUser = localStorage.getItem(USER_KEY)

  if (!storedUser) {
    clearSession()
    return { token: '', user: null }
  }

  try {
    const user = JSON.parse(storedUser)
    if(!user?.id||!user?.role)throw new Error('Invalid session')
    return { token:'cookie-session', user }
  } catch {
    clearSession()
    return { token: '', user: null }
  }
}

export const saveSession = ({ user, csrf_token }) => {
  localStorage.removeItem('sti_vio_log_token')
  localStorage.setItem(USER_KEY, JSON.stringify(displayUser(user)))
  if(csrf_token)globalThis.sessionStorage?.setItem(CSRF_KEY,csrf_token)
}

export const csrfToken=()=>globalThis.sessionStorage?.getItem(CSRF_KEY)||''
export const saveCsrf=(value)=>{if(value)globalThis.sessionStorage?.setItem(CSRF_KEY,value)}

const marks = {
  render: <path d="M5 4h8.4A5.6 5.6 0 0 1 19 9.6V20h-4v-9.8A2.2 2.2 0 0 0 12.8 8H9v12H5V4Z" fill="currentColor"/>,
  supabase: <><path d="m13.1 2-8 11.2h6.7L10.9 22l8-11.2h-6.7L13.1 2Z" fill="currentColor"/><path d="m5.1 13.2 6.7-9.4v9.4H5.1Z" fill="currentColor" opacity=".45"/></>,
  google: <><path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.7h5a4.3 4.3 0 0 1-1.9 2.8v2.4h3.1c1.8-1.7 2.8-4.1 2.8-6.9Z" fill="#4285F4"/><path d="M12 21c2.6 0 4.8-.9 6.4-2.3l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4H3.4v2.5A9.7 9.7 0 0 0 12 21Z" fill="#34A853"/><path d="M6.6 13.2a5.8 5.8 0 0 1 0-3.7V7H3.4a9.7 9.7 0 0 0 0 8.7l3.2-2.5Z" fill="#FBBC05"/><path d="M12 5.4c1.4 0 2.7.5 3.7 1.4l2.8-2.7A9.4 9.4 0 0 0 3.4 7l3.2 2.5c.8-2.4 2.9-4.1 5.4-4.1Z" fill="#EA4335"/></>,
  brevo: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" fill="currentColor" opacity=".18"/><path d="m7 9 5 3 5-3M7 15l3-1.8M17 15l-3-1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8"/></>,
  socketio: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="m13.2 5.7-5.6 7.1h4.8l-1.6 5.5 5.6-7.1h-4.8l1.6-5.5Z" fill="currentColor"/></>
}

export default function PlatformMark({ name, label, size = 26 }) {
  return <svg className={`platform-mark platform-mark--${name || 'email'}`} role="img" aria-label={`${label || 'Platform'} logo`} viewBox="0 0 24 24" width={size} height={size}>{marks[name] || marks.email}</svg>
}

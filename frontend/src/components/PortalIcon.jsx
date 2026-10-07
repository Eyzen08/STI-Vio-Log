const paths = {
  play: <path d="m8 4 12 8-12 8V4Z"/>,
  rotate: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>,
  save: <><path d="M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8"/></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></>,
  edit: <><path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  history: <><path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l4 2"/></>,
  camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
  book: <><path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  filter: <path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2M8 18h2"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  monitoring: <><path d="M3 12h4l2.2-5 4.1 10 2.2-5H21"/><path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/></>,
  students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  registrations: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h3"/></>,
  violations: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
  service: <><path d="M7 20h10M9 20v-3h6v3M6 10l6-6 6 6M8 10h8v7H8z"/></>,
  qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14h1"/></>,
  clearance: <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  messages: <><path d="M4 5h16v12H8l-4 4V5Z"/><path d="M8 9h8M8 13h5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-1.6-1H2v-4h.1A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6 1.7 1.7 0 0 0 9 2h4a1.7 1.7 0 0 0 2 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 1.6 1.6h.1v4H21a1.7 1.7 0 0 0-1.6 1.4Z"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  'chevron-right': <path d="m9 5 7 7-7 7"/>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  'panel-left-close': <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M16 9l-3 3 3 3"/></>,
  'panel-left-open': <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M13 9l3 3-3 3"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  hourglass: <><path d="M7 3h10M7 21h10M8 3c0 4 1 6 4 9-3 3-4 5-4 9M16 3c0 4-1 6-4 9 3 3 4 5 4 9"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>
}

function PortalIcon({ name, size = 18, className = '' }) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.dashboard}</svg>
}

export default PortalIcon

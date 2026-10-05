import { useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import { changeStudentPhoto, prepareAvatarPhoto } from '../lib/avatar.js'

export default function StudentAvatarUpload({ student, onUpdated }) {
  const [image, setImage] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef(null)
  const fileVersion = useRef(0)
  const choose = async (event) => {
    const version = ++fileVersion.current
    const file = event.target.files?.[0]
    setImage(''); setError(''); setMessage('')
    if (!file) return
    setBusy(true)
    try { const prepared = await prepareAvatarPhoto(file); if (version === fileVersion.current) setImage(prepared) }
    catch (failure) { if (version === fileVersion.current) { setError(failure.message); event.target.value = '' } }
    finally { if (version === fileVersion.current) setBusy(false) }
  }
  const save = async (remove) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const { avatar } = await changeStudentPhoto(student.id, { image, reason: reason.trim(), remove })
      onUpdated({ ...student, avatar }); setImage(''); setReason(''); if (input.current) input.current.value = ''
      setMessage(remove ? 'Student photo removed.' : 'Student photo saved.')
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <section className="student-avatar-editor" aria-labelledby="student-photo-title">
    <div className="student-photo-heading"><Avatar identity={student} avatar={student.avatar?.photo_url ? { ...student.avatar, source: 'PHOTO' } : student.avatar} className="avatar-preview" /><div><h4 id="student-photo-title">Student photo</h4><p>Students can choose this photo or an illustrated avatar.</p></div></div>
    <form onSubmit={(event) => { event.preventDefault(); save(false) }}>
      <label className="student-photo-file">{student.avatar?.photo_url ? 'Replace photo' : 'Upload photo'}<input ref={input} type="file" accept="image/jpeg,image/png" onChange={choose} disabled={busy} /><small>JPEG or PNG, up to 5 MB. Photos are centered in a square.</small></label>
      {image && <div className="student-photo-preview"><img src={image} alt="Preview of the new student photo" /><span>New photo preview</span></div>}
      <label>Photo change reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required disabled={busy} /></label>
      {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
      <div className="registration-review-actions"><button disabled={busy || !image || !reason.trim()} data-action-disabled={busy || !image || !reason.trim() ? 'true' : 'false'}>{busy ? 'Working…' : 'Save photo'}</button>
        {student.avatar?.photo_url && <button type="button" className="secondary-button danger-button" disabled={busy || !reason.trim()} data-action-disabled={busy || !reason.trim() ? 'true' : 'false'} onClick={() => save(true)}>Remove photo</button>}</div>
    </form>
  </section>
}

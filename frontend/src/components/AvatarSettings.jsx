import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import { AVATAR_PRESETS, getAvatar, saveAvatar } from '../lib/avatar.js'

export default function AvatarSettings({ user, onAvatarChange }) {
  const [saved, setSaved] = useState(null)
  const [selection, setSelection] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    getAvatar().then(({ avatar }) => { if (active) { setSaved(avatar); setSelection(avatar); setError('') } })
      .catch((failure) => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [user?.id, reload])
  const choose = (source, preset_id = saved?.preset_id) => {
    setSelection({ ...saved, source, preset_id }); setMessage(''); setError('')
  }
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const { avatar } = await saveAvatar({ source: selection.source, preset_id: selection.preset_id })
      setSaved(avatar); setSelection(avatar); onAvatarChange?.(avatar); setMessage('Avatar saved.')
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  const changed = saved && selection && (saved.source !== selection.source || saved.preset_id !== selection.preset_id)
  const option = (source, id, label) => {
    const checked = selection?.source === source && (source !== 'PRESET' || selection?.preset_id === id)
    const avatar = { ...saved, source, preset_id: id }
    return <label key={source === 'PRESET' ? id : source} className={`avatar-choice${checked ? ' is-selected' : ''}`}>
      <input type="radio" name="avatar-choice" value={source === 'PRESET' ? id : source} checked={checked} onChange={() => choose(source, id)} disabled={busy} />
      <Avatar identity={user} avatar={avatar} /><span className="sr-only">{label}</span>
      {checked && <span className="avatar-choice-check" aria-hidden="true">✓</span>}
    </label>
  }
  return <section className="table-card avatar-settings" aria-labelledby="avatar-settings-title">
    <header className="avatar-settings-heading"><div><h3 id="avatar-settings-title">Avatar</h3><p>Choose how you appear throughout the portal.</p></div><Avatar identity={user} avatar={selection || user?.avatar} className="avatar-preview" /></header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {!saved ? error ? <button type="button" className="secondary-button" onClick={() => setReload((value) => value + 1)}>Retry</button> : <p role="status">Loading avatars…</p> : <form onSubmit={submit}>
      <fieldset disabled={busy}><legend>Click an avatar to select it.</legend>
        <div className="avatar-special-choices"><div>{option('INITIALS', saved.preset_id, 'Use my initials')}<span>Initials</span></div>
          {saved.photo_url && <div>{option('PHOTO', saved.preset_id, 'Use my school-uploaded photo')}<span>School photo</span></div>}</div>
        <div className="avatar-preset-grid">{AVATAR_PRESETS.map(({ id, label }) => option('PRESET', id, label))}</div>
      </fieldset>
      <footer className="avatar-settings-actions"><button type="submit" disabled={busy || !changed} data-action-disabled={busy || !changed ? 'true' : 'false'}>{busy ? 'Saving…' : 'Save avatar'}</button>{message && <p className="success-message" role="status">{message}</p>}</footer>
    </form>}
  </section>
}

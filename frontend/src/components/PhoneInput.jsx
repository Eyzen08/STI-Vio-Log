import { formatPhilippinePhone, philippineMobileDigits } from '../lib/phone.js'

export default function PhoneInput({ id, name, label = 'Phone number', value, onChange, required = false, disabled = false }) {
  const update = (event) => {
    const next = philippineMobileDigits(event.target.value)
    onChange?.({ target: { name, value: next } })
  }

  return <label htmlFor={id}>{label}<input id={id} name={name} type="tel" inputMode="numeric" autoComplete="tel" placeholder="+63 9XX XXX XXXX" value={formatPhilippinePhone(value)} onChange={update} pattern="\+63 9[0-9]{2} [0-9]{3} [0-9]{4}" maxLength="17" required={required} disabled={disabled}/></label>
}

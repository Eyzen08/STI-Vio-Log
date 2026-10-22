import { useState } from 'react'
import { searchHandbookOffenses } from '../lib/violationAdmin.js'

export default function ViolationOffenseSearch({ types, onSelect }) {
  const [query, setQuery] = useState('')
  const results = searchHandbookOffenses(types, query)

  return <div className="violation-offense-search full-width-field">
    <label htmlFor="violation-offense-search"><span id="violation-offense-search-label">Search violation or offense</span>
      <input id="violation-offense-search" type="search" autoComplete="off"
        placeholder="e.g. smoking, bullying, uniform" value={query}
        aria-labelledby="violation-offense-search-label"
        aria-describedby="violation-offense-search-help violation-offense-search-status"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}/>
      <small id="violation-offense-search-help">Choose a result to fill the classification and offense, or use the dropdowns below.</small>
    </label>
    <p id="violation-offense-search-status" className="violation-offense-search-status" role="status" aria-atomic="true">
      {query.trim() ? results.length ? `${results.length} matching ${results.length === 1 ? 'offense' : 'offenses'}.` : 'No matching offenses. Try another keyword or use the dropdowns below.' : ''}
    </p>
    {results.length > 0 && <ul className="violation-offense-search-results" aria-label="Matching handbook offenses">
      {results.map(({ type, offense }) => <li key={`${type.id}:${offense}`}>
        <button type="button" onClick={() => { onSelect({ type, offense }); setQuery('') }}>
          <strong>{offense}</strong><small>{type.violation_name}</small>
        </button>
      </li>)}
    </ul>}
  </div>
}

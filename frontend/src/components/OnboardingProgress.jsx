const steps = [
  ['PASSWORD','Password'], ['GOOGLE','Google account'], ['PROFILE','Contact information'], ['COMPLETE','Portal']
]

export default function OnboardingProgress({ current }) {
  const active = Math.max(0, steps.findIndex(([key]) => key === current))
  return <ol className="onboarding-progress" aria-label="Student account setup progress">
    {steps.map(([key,label],index)=><li key={key} className={index<active?'complete':index===active?'active':''} aria-current={index===active?'step':undefined}>
      <span>{index<active?'✓':index+1}</span><b>{label}</b>
    </li>)}
  </ol>
}

import originalRelease from './policies/2026-09-10.json' with { type: 'json' }
import correctedRelease from './policies/2026-10-10.json' with { type: 'json' }

// Activation and a new acknowledgment version require institutional approval.
export const legalPolicyManifest = {
  enforcementEnabled: false,
  acknowledgmentVersion: 'terms-2026-09-10'
}

export const publishedPolicies = {
  privacy: correctedRelease.privacy,
  terms: originalRelease.terms
}

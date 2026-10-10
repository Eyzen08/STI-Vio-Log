# Privacy and analytics decision

> **Evidence boundary, October 10, 2026.** Source confirms no Analytics loading and disabled mandatory acknowledgment. Optional-cookie/legal conclusions below are project policy decisions pending institutional/DPO review, not this audit's legal opinion. Production network absence and client approval were not tested.


## Current decision

STI Vio-Log does not enable third-party behavioral analytics, advertising trackers, or nonessential cookies. The portal handles student and disciplinary information, so collecting additional user-level browsing data would add privacy risk without a defined operational need.

Authentication uses an HTTP-only secure cookie in production, with essential cookies for CSRF protection and MFA challenges. Local storage contains limited account display information and display preferences; session storage contains request-protection and temporary portal state. Authentication credentials are not kept in local storage. These uses are described in the public Privacy Notice. No optional cookie-consent banner is needed for this release.

The October 10, 2026 technical release removes Vercel Analytics loading, correcting the mismatch between the previous notice and the frontend. Mandatory Terms acknowledgment remains disabled pending administration and DPO approval. Expanded legal copy is held in [the internal review draft](privacy-terms-review.md).

## Operational measurement

Use privacy-preserving operational signals that already belong to running the service: sanitized health checks, aggregate server error rates, response latency, deployment logs, and security audit events. Do not place student names, student numbers, violation details, messages, tokens, email addresses, or guardian information in analytics events.

## Before enabling analytics

The school must first approve a written measurement purpose, event list, retention period, access list, and provider. The implementation must then:

- collect only aggregate events needed for that approved purpose;
- exclude all student and disciplinary identifiers;
- update the Privacy Notice;
- add consent controls before loading any optional tracker when required;
- honor consent withdrawal and browser privacy signals where applicable; and
- complete a production network inspection confirming that no unapproved data is sent.

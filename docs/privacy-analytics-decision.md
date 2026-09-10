# Privacy and analytics decision

## Current decision

STI Vio-Log does not enable third-party behavioral analytics, advertising trackers, or nonessential cookies. The portal handles student and disciplinary information, so collecting additional user-level browsing data would add privacy risk without a defined operational need.

The frontend uses browser local storage only for the authenticated session. This is described in the public Privacy Policy. Because no optional cookies or tracking technologies are currently enabled, a cookie-consent banner would be misleading and has intentionally not been added.

## Operational measurement

Use privacy-preserving operational signals that already belong to running the service: sanitized health checks, aggregate server error rates, response latency, deployment logs, and security audit events. Do not place student names, student numbers, violation details, messages, tokens, email addresses, or guardian information in analytics events.

## Before enabling analytics

The school must first approve a written measurement purpose, event list, retention period, access list, and provider. The implementation must then:

- collect only aggregate events needed for that approved purpose;
- exclude all student and disciplinary identifiers;
- update the Privacy Policy;
- add consent controls before loading any optional tracker when required;
- honor consent withdrawal and browser privacy signals where applicable; and
- complete a production network inspection confirming that no unapproved data is sent.

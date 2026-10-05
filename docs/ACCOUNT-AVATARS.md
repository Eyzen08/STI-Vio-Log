# Account avatars

Apply `044_account_avatars.sql` with the existing migration runner before deploying the API. Existing accounts default to initials. The legacy `students.profile_image` column is retained but cannot be changed through the generic student update endpoint.

Every role can select an avatar under Account Settings. The picker includes 48 original, locally bundled SVG portraits and initials. Students with an office-uploaded photo can also choose it; selecting a preset preserves the photo.

Administrators and Discipline Office staff manage photos from Students → View Student. A reason is required for upload, replacement, and removal. Uploads select the photo; removal restores the remembered preset when the photo is active, otherwise preserves the current selection. The browser accepts JPEG/PNG files up to 5 MB and submits a centered 512×512 JPEG. The API independently validates PNG/JPEG content, dimensions, and the 1 MB decoded limit.

Photos are stored in PostgreSQL with the existing runtime-role/RLS model. Selection and photo writes share a user lock and commit with their audit records. Audit descriptions never contain image bytes.

## API

- `GET /api/account/avatar` returns `{success, avatar, preset_ids}`.
- `PATCH /api/account/avatar` accepts `{source, preset_id?}` for the authenticated user only.
- `POST /api/students/:id/avatar` accepts `{image_data_url, reason}`.
- `DELETE /api/students/:id/avatar` accepts `{reason}`.
- Photo mutations return `{success, student_id, avatar}`.
- `GET /api/avatars/:userId/photo?v=:revision` returns image bytes to the owner, office staff, or department heads whose active department has recorded attendance for the student. Unauthorized and stale-revision reads return 404. Photos use `private, no-store` caching.

Avatar metadata is `{source: 'INITIALS'|'PRESET'|'PHOTO', preset_id: string|null, photo_url: string|null}`. It appears in user, student, and account identities; messaging uses `student_avatar` and `sender_avatar`. Image data is excluded from these JSON responses and browser session storage. Broken images fall back to initials.

## Verification

Run frontend lint/build/tests and backend tests. Run `npm run test:avatars` in backend with `TEST_DATABASE_URL` pointing to a separate test database; the integration suite creates and removes its own guarded schema. To regenerate the bundled original portraits, run `node frontend/scripts/generate-avatars.mjs` from the repository root.

-- Preserve every account and invalidate stale ADMIN sessions during conversion.
UPDATE users
SET role = 'DISCIPLINE_ADMIN',
    session_version = session_version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE role = 'ADMIN';

COMMENT ON TYPE user_role IS
    'SYSTEM_ADMIN is technical-only; DISCIPLINE_ADMIN owns institutional operations. ADMIN is retained only as an inactive historical enum label.';

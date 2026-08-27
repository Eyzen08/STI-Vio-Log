-- Non-destructive closure states for assignments whose violation was
-- administratively closed or invalidated without completed service.
ALTER TYPE violation_status ADD VALUE IF NOT EXISTS 'ADMIN_CLOSED';
ALTER TYPE violation_status ADD VALUE IF NOT EXISTS 'INVALID_CANCELLED';

-- These NOT VALID constraints protect new/changed rows without silently
-- rewriting legacy data. They can be validated after legacy-data review.
ALTER TABLE community_service_assignments
    ADD CONSTRAINT community_service_required_hours_nonnegative
    CHECK (required_hours >= 0) NOT VALID;

ALTER TABLE community_service_assignments
    ADD CONSTRAINT community_service_completed_hours_valid
    CHECK (completed_hours >= 0 AND completed_hours <= required_hours) NOT VALID;

ALTER TABLE community_service_assignments
    ADD CONSTRAINT community_service_remaining_hours_valid
    CHECK (
        remaining_hours >= 0
        AND remaining_hours = GREATEST(required_hours - completed_hours, 0)
    ) NOT VALID;

ALTER TABLE violations
    ADD CONSTRAINT violations_required_service_hours_nonnegative
    CHECK (required_service_hours >= 0) NOT VALID;

ALTER TABLE violations
    ADD CONSTRAINT violations_completed_service_hours_valid
    CHECK (
        completed_service_hours >= 0
        AND completed_service_hours <= required_service_hours
    ) NOT VALID;

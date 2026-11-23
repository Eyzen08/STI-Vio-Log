-- Record whether attendance was verified with the stored QR value or a manual
-- Student Number lookup. Existing rows remain NULL because the historical
-- request method cannot be reconstructed reliably.
ALTER TABLE qr_scan_logs
    ADD COLUMN verification_method VARCHAR(20),
    ADD CONSTRAINT qr_scan_logs_verification_method_check
        CHECK (verification_method IS NULL OR verification_method IN ('QR_CODE', 'STUDENT_NUMBER'));

-- Reversal:
-- ALTER TABLE qr_scan_logs DROP COLUMN verification_method;

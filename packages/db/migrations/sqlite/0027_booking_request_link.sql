-- Protocol v2.1 (BACK-4-017 Part 1): online bookings materialize as lightweight bookings.
-- request_id = the cloud booking_requests row this booking came from; the dedupe key for the
-- delivered-exactly-once contract and (via push) the cloud's materialization link.
ALTER TABLE bookings ADD COLUMN request_id TEXT;

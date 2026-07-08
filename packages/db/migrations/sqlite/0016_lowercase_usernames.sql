-- BACK-2-021: usernames are now case-insensitive and stored lowercase.
-- Lowercase existing usernames, but skip any row whose lowercased value would collide
-- with another user (e.g. both "Boy" and "boy" exist) — those are left untouched so no
-- duplicate is created; an admin can reconcile them manually. Realistically none collide yet.
-- Idempotent: rows already lowercase fail the `username <> lower(username)` guard.
UPDATE users
SET username = lower(username)
WHERE username <> lower(username)
  AND NOT EXISTS (
    SELECT 1 FROM users u2
    WHERE u2.id <> users.id
      AND lower(u2.username) = lower(users.username)
  );

-- Session-scoped active role on refresh_token (per-device mode).
-- Backfill from user.active_role_id so existing rows stay valid.

ALTER TABLE refresh_token
  ADD COLUMN active_role_id CHAR(36) NULL AFTER user_id;

UPDATE refresh_token rt
INNER JOIN user u ON u.id = rt.user_id
SET rt.active_role_id = u.active_role_id
WHERE rt.active_role_id IS NULL;

ALTER TABLE refresh_token
  MODIFY COLUMN active_role_id CHAR(36) NOT NULL;

CREATE INDEX refresh_token_active_role_id ON refresh_token (active_role_id);

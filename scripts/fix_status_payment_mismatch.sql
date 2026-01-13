
-- Fix patients who are labeled 'first_visit' but have 2+ DISTINCT interaction days (Visits OR Payments)
-- Upgrades them to 'active' (returning)

UPDATE patients 
SET 
    status = 'active', 
    updated_at = unixepoch()
WHERE id IN (
    SELECT patient_id 
    FROM (
        SELECT patient_id, COUNT(DISTINCT date(interact_at, 'unixepoch', 'localtime')) as distinct_days
        FROM (
            SELECT patient_id, event_date as interact_at FROM patient_events WHERE type = 'visit'
            UNION ALL
            SELECT patient_id, paid_at as interact_at FROM payments WHERE amount > 0 AND status = 'completed'
        )
        GROUP BY patient_id
        HAVING distinct_days >= 2
    )
) 
AND status = 'first_visit'
AND deleted_at IS NULL;

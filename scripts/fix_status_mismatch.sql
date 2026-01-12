
-- Fix patients who are labeled 'first_visit' but have 2+ visits
-- Upgrades them to 'active' (returning)

UPDATE patients 
SET 
    status = 'active', 
    updated_at = unixepoch()
WHERE id IN (
    SELECT p.id 
    FROM patients p
    JOIN patient_events e ON p.id = e.patient_id
    WHERE 
        p.status = 'first_visit' 
        AND e.type = 'visit'
        AND p.deleted_at IS NULL
    GROUP BY p.id
    HAVING COUNT(e.id) >= 2
);

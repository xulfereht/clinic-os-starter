
-- Identify patients with status 'first_visit' but have 2 or more visit events

SELECT 
    p.id, 
    p.name, 
    p.status, 
    COUNT(e.id) as visit_count
FROM patients p
JOIN patient_events e ON p.id = e.patient_id
WHERE 
    p.status = 'first_visit'
    AND e.type = 'visit'
    AND p.deleted_at IS NULL
GROUP BY p.id
HAVING visit_count >= 2;

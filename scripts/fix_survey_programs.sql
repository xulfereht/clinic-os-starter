UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/wellness') WHERE id = 'detox_diet';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/digestive') WHERE id = 'digestive_age';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/neuro') WHERE id = 'neuro_stress';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/pain') WHERE id = 'pain_signal';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/woman') WHERE id = 'women_balance';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/pediatric') WHERE id = 'child_growth';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/skin') WHERE id = 'skin_barrier';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', '/programs/wellness') WHERE id = 'wellness_burnout';

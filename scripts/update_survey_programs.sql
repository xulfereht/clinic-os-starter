UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', 'wellness') WHERE id = 'detox_diet';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', 'digestive') WHERE id = 'digestive_age';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', 'neuro') WHERE id = 'neuro_stress';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', 'pain') WHERE id = 'pain_signal';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', 'woman') WHERE id = 'women_balance';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', 'pediatric') WHERE id = 'child_growth';
UPDATE surveys SET definition = json_set(definition, '$.relatedProgram', 'skin') WHERE id = 'skin_barrier';

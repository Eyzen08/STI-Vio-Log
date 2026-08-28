INSERT INTO violation_types (violation_code, violation_name, description, severity, default_service_hours, is_active)
VALUES
('HANDBOOK_MINOR', 'Minor Offense', 'Student decorum, uniform or ID, inappropriate attire, property misuse, disruption, office procedure, cigarettes or vapes, pets, and comparable minor offenses.', 'MINOR', 0, TRUE),
('HANDBOOK_MAJOR_A', 'Major Offense - Category A', 'Repeated minor offenses, ID misuse, campus smoking or intoxication, unauthorized visitors, cheating, plagiarism, and comparable Category A offenses.', 'MAJOR', 0, TRUE),
('HANDBOOK_MAJOR_B', 'Major Offense - Category B', 'Property or reputation damage, privacy-violating recordings, false testimony, grave insults, and comparable Category B offenses.', 'MAJOR', 0, TRUE),
('HANDBOOK_MAJOR_C', 'Major Offense - Category C', 'Hacking, theft, fund misuse, bullying, physical injury or assault, safety threats, and comparable Category C offenses.', 'GRAVE', 0, TRUE),
('HANDBOOK_MAJOR_D', 'Major Offense - Category D', 'Illegal drugs, weapons, hazing, crimes involving moral turpitude, sexual harassment, extortion, subversion, and serious examination-material offenses.', 'GRAVE', 0, TRUE)
ON CONFLICT (violation_code) DO UPDATE SET
violation_name = EXCLUDED.violation_name,
description = EXCLUDED.description,
severity = EXCLUDED.severity,
default_service_hours = 0,
is_active = TRUE;

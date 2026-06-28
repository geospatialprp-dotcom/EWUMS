-- Work packages must be created by admin in the app (remove demo pre-seed)
UPDATE dpr_reports SET work_package_id = NULL WHERE work_package_id IS NOT NULL;
UPDATE measurement_books SET work_package_id = NULL WHERE work_package_id IS NOT NULL;
DELETE FROM work_packages;

-- ============================================================
-- Migration: add days_of_week, priority, max_hours to hourly_rates
-- Run AFTER initial schema if upgrading an existing database.
-- For fresh deployments, schema.sql already includes these columns.
-- ============================================================

-- Add new columns (safe — fails silently if they already exist)
ALTER TABLE hourly_rates ADD COLUMN days_of_week TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE hourly_rates ADD COLUMN priority      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE hourly_rates ADD COLUMN max_hours     REAL;

-- Patch default rows with correct values
UPDATE hourly_rates SET days_of_week = '[1,2,3,4,5,6]', priority = 1, max_hours = 8     WHERE id = 'g-standard';
UPDATE hourly_rates SET days_of_week = '[0]',            priority = 1, max_hours = 8     WHERE id = 'g-sunday';
UPDATE hourly_rates SET days_of_week = '[1,2,3,4,5,6]', priority = 2, max_hours = NULL  WHERE id = 'g-overtime';
UPDATE hourly_rates SET days_of_week = '[0]',            priority = 2, max_hours = NULL  WHERE id = 'g-sunday-overtime';
UPDATE hourly_rates SET days_of_week = '[0,1,2,3,4,5,6]',priority= 0, max_hours = NULL  WHERE id = 'g-public-holiday';

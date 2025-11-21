-- Add new columns to uploads table for tender information
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS value_eur text;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS phase text;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS cup text;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS appalto_location text;

-- Add new columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_company text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_surname text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS appalto_location text;

-- Remove tender-specific columns from leads table (they belong in uploads now)
ALTER TABLE leads DROP COLUMN IF EXISTS cig_appalto;
ALTER TABLE leads DROP COLUMN IF EXISTS descrizione_appalto;
ALTER TABLE leads DROP COLUMN IF EXISTS value_eur;
ALTER TABLE leads DROP COLUMN IF EXISTS phase;
ALTER TABLE leads DROP COLUMN IF EXISTS cup;

-- Remove unused columns
ALTER TABLE leads DROP COLUMN IF EXISTS lead_name;
ALTER TABLE leads DROP COLUMN IF EXISTS full_name;
ALTER TABLE leads DROP COLUMN IF EXISTS role_title;
ALTER TABLE leads DROP COLUMN IF EXISTS lead_region;
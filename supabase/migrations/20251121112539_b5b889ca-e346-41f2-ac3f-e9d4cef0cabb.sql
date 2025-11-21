-- Add tender-specific fields to leads table so each lead carries its tender information
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cig_appalto text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS descrizione_appalto text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS value_eur text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phase text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cup text;
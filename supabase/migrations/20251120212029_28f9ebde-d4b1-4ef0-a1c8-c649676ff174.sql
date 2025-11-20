-- Add new columns for updated n8n format
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_category text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_status text;

-- Remove old columns that are no longer used
ALTER TABLE leads DROP COLUMN IF EXISTS lead_kind;
ALTER TABLE leads DROP COLUMN IF EXISTS lead_subtype;
ALTER TABLE leads DROP COLUMN IF EXISTS appalto_location;
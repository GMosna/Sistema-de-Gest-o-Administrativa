-- Add supplier_name column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_name TEXT;

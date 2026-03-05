-- Supabase Schema for Product Analyzer

-- 1. Metadata Database Tables
CREATE TABLE IF NOT EXISTS configuration_field (
  configuration_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  friendly_name TEXT,
  tracked BOOLEAN NOT NULL DEFAULT FALSE,
  created_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid(), -- Optional: for multi-user support
  PRIMARY KEY (configuration_id, field_key)
);

-- Enable RLS for Metadata
ALTER TABLE configuration_field ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own configuration fields"
ON configuration_field FOR ALL USING (auth.uid() = user_id);

-- 2. Source Database Tables (Imported from Husqvarna SQLite)
CREATE TABLE IF NOT EXISTS device_snapshot (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  product_number TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  time_stamp_utc TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS device_snapshot_json (
  device_snapshot_id TEXT PRIMARY KEY REFERENCES device_snapshot(id),
  json TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_snapshot_pn_sn ON device_snapshot(product_number, serial_number);
CREATE INDEX IF NOT EXISTS idx_device_snapshot_timestamp ON device_snapshot(time_stamp_utc DESC);

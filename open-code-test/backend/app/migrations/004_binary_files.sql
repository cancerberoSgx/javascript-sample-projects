ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS data BYTEA;
ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;

UPDATE drive_items
SET data = convert_to(content, 'UTF8'),
    size_bytes = octet_length(convert_to(content, 'UTF8'))
WHERE kind = 'file'
  AND data IS NULL;

ALTER TABLE drive_items DROP CONSTRAINT IF EXISTS drive_items_file_fields_check;
ALTER TABLE drive_items DROP COLUMN IF EXISTS content;

ALTER TABLE drive_items ADD CONSTRAINT drive_items_file_fields_check CHECK (
    (kind = 'folder' AND file_type IS NULL AND data IS NULL AND size_bytes = 0)
    OR (
        kind = 'file'
        AND file_type IS NOT NULL
        AND data IS NOT NULL
        AND size_bytes = octet_length(data)
    )
);

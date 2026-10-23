CREATE TABLE IF NOT EXISTS drives (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drives_name_check CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_drives_organization_id ON drives (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drives_organization_name_unique
    ON drives (organization_id, lower(name));

CREATE TABLE IF NOT EXISTS drive_items (
    id BIGSERIAL PRIMARY KEY,
    drive_id BIGINT NOT NULL REFERENCES drives (id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES drive_items (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    file_type TEXT,
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drive_items_kind_check CHECK (kind IN ('folder', 'file')),
    CONSTRAINT drive_items_name_check CHECK (length(btrim(name)) > 0),
    CONSTRAINT drive_items_file_fields_check CHECK (
        (kind = 'folder' AND file_type IS NULL AND content IS NULL)
        OR (kind = 'file' AND file_type = 'text/plain' AND content IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_drive_items_drive_parent ON drive_items (drive_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_items_parent_id ON drive_items (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_items_parent_name_unique
    ON drive_items (drive_id, COALESCE(parent_id, 0), lower(name));

DROP TRIGGER IF EXISTS drives_set_updated_at ON drives;
CREATE TRIGGER drives_set_updated_at
    BEFORE UPDATE ON drives
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS drive_items_set_updated_at ON drive_items;
CREATE TRIGGER drive_items_set_updated_at
    BEFORE UPDATE ON drive_items
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

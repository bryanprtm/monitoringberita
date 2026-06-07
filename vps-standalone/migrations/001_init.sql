-- Schema awal: setara dengan tabel Supabase project ini
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username     text UNIQUE NOT NULL,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rss_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  category    text NOT NULL DEFAULT 'NAT',
  url         text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS youtube_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  url         text NOT NULL,
  category    text NOT NULL DEFAULT 'LIVE',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION notify_source_change() RETURNS trigger AS $$
DECLARE
  channel text := TG_TABLE_NAME || '_changed';
  payload json;
BEGIN
  payload := json_build_object('op', TG_OP, 'id', COALESCE(NEW.id, OLD.id));
  PERFORM pg_notify(channel, payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rss_sources_notify ON rss_sources;
CREATE TRIGGER rss_sources_notify
  AFTER INSERT OR UPDATE OR DELETE ON rss_sources
  FOR EACH ROW EXECUTE FUNCTION notify_source_change();

DROP TRIGGER IF EXISTS youtube_sources_notify ON youtube_sources;
CREATE TRIGGER youtube_sources_notify
  AFTER INSERT OR UPDATE OR DELETE ON youtube_sources
  FOR EACH ROW EXECUTE FUNCTION notify_source_change();
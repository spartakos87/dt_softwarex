-- No real deployment data. Used by a fresh PostgreSQL data volume only.
CREATE TABLE IF NOT EXISTS buildings (
 id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, locations JSON DEFAULT '{}'::JSON);
CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL,
 password VARCHAR(255) NOT NULL,building_id INTEGER NOT NULL REFERENCES buildings(id));
CREATE TABLE IF NOT EXISTS sensor_types (
 id SERIAL PRIMARY KEY, type VARCHAR(100) UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS sensors (
 id VARCHAR(255) PRIMARY KEY, name VARCHAR(100) NOT NULL,location VARCHAR(255),
 floor INTEGER DEFAULT 0 NOT NULL,latest_data JSON DEFAULT '{}'::JSON,
 last_updated TIMESTAMP,building_id INTEGER NOT NULL REFERENCES buildings(id),
 type_id INTEGER NOT NULL REFERENCES sensor_types(id));
CREATE TABLE IF NOT EXISTS sensor_data (
 id BIGSERIAL PRIMARY KEY,sensor_id VARCHAR(255) REFERENCES sensors(id) ON DELETE CASCADE,
 data JSON NOT NULL,timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS sensor_history_idx ON sensor_data(sensor_id,timestamp DESC);

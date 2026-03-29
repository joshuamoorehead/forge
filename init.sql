-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create separate database for Airflow metadata
SELECT 'CREATE DATABASE airflow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'airflow')\gexec

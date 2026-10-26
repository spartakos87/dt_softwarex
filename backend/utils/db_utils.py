"""Database configuration supplied through the container environment."""
import logging
import os
import psycopg2

logger=logging.getLogger(__name__)

def connect_to_db():
    try:
        return psycopg2.connect(dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'], host=os.getenv('DB_HOST','db'),
            port=int(os.getenv('DB_PORT','5432')),connect_timeout=5)
    except (psycopg2.Error, KeyError, ValueError):
        logger.exception('Database unavailable')
        return None

import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(r"database\.env")


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "company_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}

def create_tables():
    commands = [
        """
        CREATE TABLE IF NOT EXISTS department (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            location VARCHAR(100),
            head_of_department INT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS employee (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            hire_date DATE NOT NULL,
            manager_id INT REFERENCES employee(id),
            dept_id INT REFERENCES department(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS salary (
            id SERIAL PRIMARY KEY,
            employee_id INT REFERENCES employee(id),
            amount NUMERIC(12,2) NOT NULL,
            effective_from DATE NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS address (
            id SERIAL PRIMARY KEY,
            employee_id INT REFERENCES employee(id),
            city VARCHAR(100),
            state VARCHAR(100),
            pin_code VARCHAR(20)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS job_history (
            id SERIAL PRIMARY KEY,
            employee_id INT REFERENCES employee(id),
            old_role VARCHAR(100),
            new_role VARCHAR(100),
            changed_on DATE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS dept_assignment (
            id SERIAL PRIMARY KEY,
            employee_id INT REFERENCES employee(id),
            dept_id INT REFERENCES department(id),
            allocation_percent INT
        )
        """
    ]

    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        for command in commands:
            cur.execute(command)
        conn.commit()
        cur.close()
        print("Tables created successfully.")
    except Exception as e:
        print("Error:", e)
    finally:
        if conn is not None:
            conn.close()

if __name__ == "__main__":
    create_tables()

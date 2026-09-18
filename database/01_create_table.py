import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv("database/.env")


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

def create_readonly_role():
    """Create (or update) a Postgres role that can only SELECT from the app's
    tables. The backend's query-execution endpoint connects as this role
    instead of the admin user, so even a bug that lets bad SQL through can't
    write to or drop anything."""
    ro_user = os.getenv("DB_RO_USER")
    ro_password = os.getenv("DB_RO_PASSWORD")
    db_name = DB_CONFIG["dbname"]

    if not ro_user or not ro_password:
        print("DB_RO_USER / DB_RO_PASSWORD not set - skipping read-only role setup.")
        return

    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (ro_user,))
        if cur.fetchone():
            cur.execute(
                sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD %s").format(sql.Identifier(ro_user)),
                (ro_password,),
            )
        else:
            cur.execute(
                sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(sql.Identifier(ro_user)),
                (ro_password,),
            )

        # Connect + read privileges only - nothing else.
        cur.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
            sql.Identifier(db_name), sql.Identifier(ro_user)))
        cur.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(sql.Identifier(ro_user)))
        cur.execute(sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA public TO {}").format(
            sql.Identifier(ro_user)))
        # So SELECT also works on any table added later by a future migration.
        cur.execute(sql.SQL(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO {}"
        ).format(sql.Identifier(ro_user)))
        # Explicitly block schema/object creation, just to be safe.
        cur.execute(sql.SQL("REVOKE CREATE ON SCHEMA public FROM {}").format(sql.Identifier(ro_user)))

        cur.close()
        print(f"Read-only role '{ro_user}' is ready with SELECT-only access.")
    except Exception as e:
        print("Error setting up read-only role:", e)
    finally:
        if conn is not None:
            conn.close()

if __name__ == "__main__":
    create_tables()
    create_readonly_role()

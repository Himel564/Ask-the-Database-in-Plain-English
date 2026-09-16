import psycopg2
from dotenv import load_dotenv
import os
load_dotenv(r"database\.env")
print(os.getenv("db_password"))
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres",
    "password": os.getenv("db_password"),
}


def execute_query(query):
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            if cur.description:
                columns = [col[0] for col in cur.description]
                rows = cur.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            conn.commit()
            return {"affected_rows": cur.rowcount}
    except Exception as e:
        conn.rollback()
        return {"error": str(e)}
    finally:
        conn.close()


if __name__ == "__main__":
    query = input("Enter SQL query: ")
    print(execute_query(query))
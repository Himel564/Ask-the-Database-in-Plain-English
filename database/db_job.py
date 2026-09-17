import re

import psycopg2
from dotenv import load_dotenv
import os

load_dotenv("database/.env")

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "company_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}

RO_DB_CONFIG = {
    **DB_CONFIG,
    "user": os.getenv("DB_RO_USER", DB_CONFIG["user"]),
    "password": os.getenv("DB_RO_PASSWORD", DB_CONFIG["password"]),
}





_STATEMENT_TIMEOUT_MS = int(os.getenv("QUERY_TIMEOUT_MS", "5000"))

_ALLOWED_START = re.compile(r"^\s*(with|select)\b", re.IGNORECASE)
_FORBIDDEN_KEYWORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|"
    r"call|do|vacuum|reindex|refresh|listen|notify|set|reset)\b",
    re.IGNORECASE,
)


def _validate_select_only(query: str):
    stripped = query.strip()
    if not stripped:
        return "Query is empty."

    body = stripped[:-1] if stripped.endswith(";") else stripped
    if ";" in body:
        return "Only a single SQL statement is allowed."

    if not _ALLOWED_START.match(body):
        return "Sorry You cannot delete anything from the database."

    if _FORBIDDEN_KEYWORDS.search(body):
        return "Query contains a keyword that isn't allowed for read-only access."

    return None

def execute_query(query, admin: bool = False):
    if not admin:
        error = _validate_select_only(query)
        if error:
            return {"error": error}

    config = DB_CONFIG if admin else RO_DB_CONFIG
    conn = psycopg2.connect(**config)
    try:
        with conn.cursor() as cur:
            if not admin:
                cur.execute("SET LOCAL statement_timeout = %s", (_STATEMENT_TIMEOUT_MS,))
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
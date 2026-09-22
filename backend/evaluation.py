
from collections import Counter

from database.db_job import execute_query


def _row_signature(row):
    """Turn a result row into a hashable signature based only on values,
    ignoring column names. Values are stringified for type consistency."""
    return tuple(sorted(str(v) for v in row.values()))



def _run(sql):
    """Run a SQL string with the existing execute_query helper and
    normalize the outcome into (rows, error)."""
    if not sql or not sql.strip():
        return None, "No SQL query was provided."
    result = execute_query(sql)
    if isinstance(result, dict) and "error" in result:
        return None, result["error"]
    if isinstance(result, dict) and "affected_rows" in result:
        
        return [result], None
    return result or [], None


def evaluate_queries(question, generated_sql, actual_sql):
    """Compare the model-generated SQL against the user-provided correct
    SQL for the same question. Returns a JSON-serializable dict."""
    generated_rows, generated_error = _run(generated_sql)
    actual_rows, actual_error = _run(actual_sql)

    if generated_error or actual_error:
        return {
            "question": question,
            "generated_sql": generated_sql,
            "actual_sql": actual_sql,
            "generated_error": generated_error,
            "actual_error": actual_error,
            "exact_match": False,
            "row_accuracy": 0.0,
            "generated_row_count": len(generated_rows) if generated_rows else 0,
            "actual_row_count": len(actual_rows) if actual_rows else 0,
            "generated_rows": generated_rows or [],
            "actual_rows": actual_rows or [],
        }

    generated_counter = Counter(_row_signature(r) for r in generated_rows)
    actual_counter = Counter(_row_signature(r) for r in actual_rows)

    intersection = sum((generated_counter & actual_counter).values())
    union = sum((generated_counter | actual_counter).values())
    row_accuracy = 100.0 if union == 0 else round(intersection / union * 100, 1)
    exact_match = generated_counter == actual_counter

    return {
        "question": question,
        "generated_sql": generated_sql,
        "actual_sql": actual_sql,
        "generated_error": None,
        "actual_error": None,
        "exact_match": exact_match,
        "row_accuracy": row_accuracy,
        "generated_row_count": len(generated_rows),
        "actual_row_count": len(actual_rows),
        "generated_rows": generated_rows,
        "actual_rows": actual_rows,
    }
"""Evaluation helper: compares a model-generated SQL query against a
user-supplied "correct" SQL query, so we can measure how accurate the
model's SQL generation actually is.

Accuracy is based purely on running both queries against the real database
and comparing what they return (order-independent, column-value based) -
not on how similar the two SQL strings look. Two differently-written
queries can still return identical data, and that's what actually matters.
"""

from collections import Counter

from database.db_job import execute_query


def _row_signature(row):
    """Turn a result row (dict) into something hashable and comparable,
    independent of column order. Values are stringified so equivalent
    values of different types (e.g. Decimal vs float) still match."""
    return tuple(sorted((str(k), str(v)) for k, v in row.items()))


def _run(sql):
    """Run a SQL string with the existing execute_query helper and
    normalize the outcome into (rows, error)."""
    if not sql or not sql.strip():
        return None, "No SQL query was provided."
    result = execute_query(sql)
    if isinstance(result, dict) and "error" in result:
        return None, result["error"]
    if isinstance(result, dict) and "affected_rows" in result:
        # Not a SELECT - nothing to compare row-by-row.
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
    }
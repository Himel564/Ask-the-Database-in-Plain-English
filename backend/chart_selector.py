
import re
from datetime import date, datetime
from decimal import Decimal

VALID_TYPES = ("bar", "pie", "line")
MAX_BARS = 30
MAX_PIE_SLICES = 6

MAX_BARS_REQUESTED = 50
MAX_PIE_SLICES_REQUESTED = 12

_ASKED = {
    "pie": re.compile(r"\b(pie|donut|doughnut)\b", re.I),
    "bar": re.compile(r"\b(bar|bars|column\s*(chart|graph))\b", re.I),
    "line": re.compile(r"\bline\s*(chart|graph|plot)?\b", re.I),
}

_TIME_NAME = re.compile(r"(date|year|month|day|week|quarter|time|period|_on$|_at$)", re.I)
_DATE_TEXT = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?([ T].*)?$")
_ID_NAME = re.compile(r"(^id$|_id$)", re.I)
_NOT_PIE_NAME = re.compile(r"(avg|average|mean|median|percent|pct|rate|ratio|min|max)", re.I)


def _is_num(v):
    return isinstance(v, (int, float, Decimal)) and not isinstance(v, bool)


def _values(rows, col):
    return [r.get(col) for r in rows if r.get(col) is not None]


def _is_numeric_col(rows, col):
    vals = _values(rows, col)
    return bool(vals) and all(_is_num(v) for v in vals)


def _is_time_col(rows, col):
    vals = _values(rows, col)
    if not vals:
        return False
    if all(isinstance(v, (date, datetime)) for v in vals):
        return True
    if all(isinstance(v, str) and _DATE_TEXT.match(v) for v in vals):
        return True
    
    if _TIME_NAME.search(col) and all(_is_num(v) for v in vals):
        return True
    return False


def requested_types(question):
    """NEW: chart types the user named in the question, in the order they appear."""
    if not question:
        return []
    found = []
    for ctype, pattern in _ASKED.items():
        m = pattern.search(question)
        if m:
            found.append((m.start(), ctype))
    return [t for _, t in sorted(found)]


def _check(spec, columns, rows, requested=False):
    """Return a cleaned chart spec if it fits the data, otherwise None.
    requested=True (user named this chart) uses looser limits."""
    if not isinstance(spec, dict):
        return None
    ctype = str(spec.get("type", "")).lower().strip()
    x, y = spec.get("x"), spec.get("y")
    if ctype not in VALID_TYPES or x not in columns or y not in columns or x == y:
        return None
    if not _is_numeric_col(rows, y) or _ID_NAME.search(y):
        return None

    n = len(rows)
    x_is_time = _is_time_col(rows, x)

    if ctype == "line":
        # asked for: any x is fine; otherwise only time columns
        if n < 2 or (not x_is_time and not requested):
            return None
    elif ctype == "bar":
        if n < 2 or n > (MAX_BARS_REQUESTED if requested else MAX_BARS):
            return None
    elif ctype == "pie":
        if n < 2 or n > (MAX_PIE_SLICES_REQUESTED if requested else MAX_PIE_SLICES):
            return None
        if not requested and (x_is_time or _NOT_PIE_NAME.search(y)):
            return None
        # a pie can never draw negative values or a zero total
        nums = [float(v) for v in _values(rows, y)]
        if any(v < 0 for v in nums) or sum(nums) <= 0:
            return None

    reason = str(spec.get("reason") or "").strip()
    return {"type": ctype, "x": x, "y": y, "reason": reason[:120]}


def _fallback(columns, rows):
    """Pick charts ourselves when the LLM gave nothing usable."""
    if len(rows) < 2:
        return []

    time_cols = [c for c in columns if _is_time_col(rows, c)]
    num_cols = [c for c in columns
                if _is_numeric_col(rows, c) and not _ID_NAME.search(c) and c not in time_cols]
    if not num_cols:
        return []
    y = num_cols[0]

    if time_cols:
        x = time_cols[0]
        charts = [{"type": "line", "x": x, "y": y, "reason": "Shows change over time"}]
        if len(rows) <= 12:
            charts.append({"type": "bar", "x": x, "y": y, "reason": "Compares each period"})
        return charts

    label_cols = [c for c in columns if c not in num_cols and not _ID_NAME.search(c)]
    if not label_cols:
        return []
    x = label_cols[0]
    candidates = [
        {"type": "bar", "x": x, "y": y, "reason": "Compares values across categories"},
        {"type": "pie", "x": x, "y": y, "reason": "Shows each part of the whole"},
    ]
    return [c for c in (_check(s, columns, rows) for s in candidates) if c]


def _guess_xy(columns, rows):
    """NEW: best x / y columns when we must build a chart ourselves."""
    time_cols = [c for c in columns if _is_time_col(rows, c)]
    num_cols = [c for c in columns
                if _is_numeric_col(rows, c) and not _ID_NAME.search(c) and c not in time_cols]
    if not num_cols:
        return None, None
    label_cols = [c for c in columns if c not in num_cols and not _ID_NAME.search(c)]
    x = (label_cols or time_cols or [None])[0]
    return x, num_cols[0]


_ASKED_REASON = {"pie": "You asked for a pie chart", "bar": "You asked for a bar chart",
                 "line": "You asked for a line chart"}


def select_charts(llm_charts, columns, rows, question=""):
    """Main entry: validate the LLM's chart list, fall back to rules if needed.
    NEW: charts the user named in the question come first with looser limits."""
    if not rows or not columns:
        return []

    asked = requested_types(question)

    chosen, seen = [], set()
    for spec in llm_charts or []:
        ctype = str(spec.get("type", "")).lower() if isinstance(spec, dict) else ""
        checked = _check(spec, columns, rows, requested=ctype in asked)
        if checked and checked["type"] not in seen:
            seen.add(checked["type"])
            chosen.append(checked)

    if not chosen:
        chosen = _fallback(columns, rows)
        seen = {c["type"] for c in chosen}

    # NEW: add a chart the user asked for if the LLM forgot it
    for ctype in asked:
        if ctype in seen:
            continue
        base = chosen[0] if chosen else None
        x, y = (base["x"], base["y"]) if base else _guess_xy(columns, rows)
        checked = _check({"type": ctype, "x": x, "y": y, "reason": _ASKED_REASON[ctype]},
                         columns, rows, requested=True)
        if checked:
            seen.add(ctype)
            chosen.append(checked)

    chosen.sort(key=lambda c: asked.index(c["type"]) if c["type"] in asked else len(asked))

    return chosen[:3]
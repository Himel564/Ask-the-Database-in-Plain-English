from database.db_schemas import database_schema
import os
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser
from langchain_community.document_loaders import PDFPlumberLoader
import pdfplumber




load_dotenv(r"backend\.env")

_pdf_store = {"filename": None, "context": None, "pages": 0}

_MAX_CONTEXT_CHARS = 20000


def _tables_to_text(tables):
    """Render pdfplumber's extracted tables as plain-text rows so the LLM
    can read them like a simple text table (row cells separated by ' | ')."""
    lines = []
    for t_idx, table in enumerate(tables, start=1):
        lines.append(f"[Table {t_idx}]")
        for row in table:
            cells = [("" if cell is None else str(cell).strip()) for cell in row]
            lines.append(" | ".join(cells))
    return "\n".join(lines)


def load_and_index_pdf(file_path):
    """Load a PDF with a LangChain document loader, then enrich each page
    with any tabular data pdfplumber can extract, and cache the combined
    text as context for later question answering."""
    try:
        #
        loader = PDFPlumberLoader(file_path)
        documents = loader.load()

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if i >= len(documents):
                    break
                tables = page.extract_tables()
                if tables:
                    table_text = _tables_to_text(tables)
                    documents[i].page_content = (
                        f"{documents[i].page_content}\n\n{table_text}".strip()
                    )

        full_context = "\n\n".join(doc.page_content for doc in documents if doc.page_content)

        if not full_context.strip():
            return {"status": "error", "error": "No readable text or tables found in this PDF."}

        _pdf_store["filename"] = os.path.basename(file_path)
        _pdf_store["context"] = full_context
        _pdf_store["pages"] = len(documents)

        return {
            "status": "success",
            "filename": _pdf_store["filename"],
            "pages": _pdf_store["pages"],
            "message": f"Indexed {_pdf_store['pages']} page(s) from {_pdf_store['filename']}.",
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def query_pdf_context(question):
    """Answer a natural-language question using the previously loaded PDF's
    content (including any extracted tables) as context for the LLM."""
    context = _pdf_store.get("context")
    if not context:
        return "Please upload a PDF first before asking questions about it."

    if len(context) > _MAX_CONTEXT_CHARS:
        context = context[:_MAX_CONTEXT_CHARS]

    model = init_chat_model(
        "groq:openai/gpt-oss-120b"
    )

    template = PromptTemplate(
        input_variables=["question", "context"],
        template="""
    You are a helpful assistant that answers questions using ONLY the content
    extracted from an uploaded PDF document, including any tables it contains.

    PDF content:
    {context}

    Rules:
    1. Answer strictly using the information in the PDF content above.
    2. Pay close attention to any tabular data (rows separated by "|") when answering.
    3. If the answer cannot be found in the PDF content, say so clearly instead of guessing.
    4. Be concise and directly answer the question.
    5. give the answers in a simple string format without any markdown or code blocks.

    Question:
    {question}

    Answer:
    """
    )

    chain = template | model | StrOutputParser()
    try:
        result = chain.invoke({
            "question": question,
            "context": context,
        })
    except Exception as e:
        return f"Error generating answer: {e}"
    else:
        return result


def generate_response(question):

    model = init_chat_model(
        "groq:openai/gpt-oss-120b"
    )

    template = PromptTemplate(
    input_variables=["question", "schema"],
    template="""
        You are an expert SQL generator.

        Convert the user's natural language question into ONE valid SQL query.

        Database dialect: PostgreSQL

        Database schema:
        {schema}

        Rules:
        1. Use only tables and columns present in the schema.
        2. Do not invent columns.
        3. Do not use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE or CREATE.
        4. Generate only SELECT queries.
        5. Correctly use JOIN, GROUP BY, ORDER BY, aggregate functions and subqueries when required.
        6. For "highest", "lowest", "maximum", "minimum", "top N", or "second highest/lowest" questions:
        - Always consider only the latest record when a history table exists (e.g. salary history with effective_from).
        - Use DISTINCT when ranking values to avoid duplicates from the same entity.
        - Use ORDER BY with LIMIT/OFFSET for ranking.
        7. Always ensure each entity (e.g. employee) contributes only its most recent record when multiple exist.
        8. Return ONLY the SQL query.
        9. Do not use markdown.
        10. Do not include explanations.
        11. If the user input is NOT a clear question that can be answered from this schema
            (for example greetings like "ok", "hi", "thanks", random words, meaningless text,
            or questions about data that does not exist in the schema), return exactly:
            INVALID_QUESTION
            and nothing else.

        ### Examples

        User question: "Find the highest salary with employee details"
        SQL:
        WITH latest_salary AS (
            SELECT s.employee_id, s.amount,
                ROW_NUMBER() OVER (PARTITION BY s.employee_id ORDER BY s.effective_from DESC) AS rn
            FROM salary s
        )
        SELECT e.id, e.name, e.hire_date, e.manager_id, e.dept_id, ls.amount
        FROM latest_salary ls
        JOIN employee e ON e.id = ls.employee_id
        WHERE ls.rn = 1
        ORDER BY ls.amount DESC
        LIMIT 1;

        User question: "Find the second highest salary with employee details"
        SQL:
        WITH latest_salary AS (
            SELECT s.employee_id, s.amount,
                ROW_NUMBER() OVER (PARTITION BY s.employee_id ORDER BY s.effective_from DESC) AS rn
            FROM salary s
        )
        SELECT e.id, e.name, e.hire_date, e.manager_id, e.dept_id, ls.amount
        FROM latest_salary ls
        JOIN employee e ON e.id = ls.employee_id
        WHERE ls.rn = 1
        AND ls.amount = (
            SELECT DISTINCT amount
            FROM latest_salary
            WHERE rn = 1
            ORDER BY amount DESC
            OFFSET 1 LIMIT 1
        );

        User question: "Which city has the most employees?"
        SQL:
        SELECT city
        FROM address
        GROUP BY city
        ORDER BY COUNT(DISTINCT employee_id) DESC
        LIMIT 1;

        User question: "List all departments with their head of department"
        SQL:
        SELECT d.id, d.name, d.location, e.name AS head_name
        FROM department d
        JOIN employee e ON d.head_of_department = e.id;

        User question:
        {question}
        """
        )

    chain = template | model | StrOutputParser()
    try:
        result = chain.invoke({
            "question": question,
            "schema": database_schema
        })
    except Exception as e:
        return {"error":"LLM model cannot be reached due to token limitation. Please provide a new token. "}
    else:
        return result

def generate_pandas_query(question,column_names):

    model = init_chat_model(
        "groq:openai/gpt-oss-120b"
    )

    template = PromptTemplate(
        input_variables=["question", "column_names"],
    template = """
    You are an expert Pandas DataFrame query generator.

    Your task is to convert a user's natural language question into ONE valid Pandas expression that can be executed on a DataFrame named `df`.

    Available columns:
    {column_names}

    DataFrame name:
    df

    Rules:

    1. Use ONLY the columns provided above.
    2. Never invent column names.
    3. Assume the data is already loaded into a Pandas DataFrame called `df`.
    4. Generate only executable Pandas code.
    5. Return only the Pandas expression.
    6. Do not return markdown.
    7. Do not return explanations.
    8. Use proper filtering, sorting, grouping, aggregation, and indexing when needed.
    9. For count questions use:
    len(df[condition])
    or
    df.shape[0]
    10. For sum questions use:
        df["column"].sum()
    11. For average questions use:
        df["column"].mean()
    12. For maximum questions use:
        df["column"].max()
    13. For minimum questions use:
        df["column"].min()
    14. For unique values use:
        df["column"].unique()
    15. For top N results use:
        df.sort_values(...).head(N)
    16. For grouped results use:
        df.groupby(...).agg(...)
    17. If multiple conditions are required, use proper Pandas boolean operators:
        &
        |
    18. Always return a single executable Pandas statement.
    19. If the user input is NOT a clear question that can be answered from these columns
        (for example greetings like "ok", "hi", "thanks", random words, meaningless text,
        or questions about columns that do not exist), return exactly:
        INVALID_QUESTION
        and nothing else.

    Examples:

    Question:
    Show all employees from Sales department

    Output:
    df[df["Department"] == "Sales"]

    Question:
    What is the highest salary?

    Output:
    df["Salary"].max()

    Question:
    Show top 5 employees by salary

    Output:
    df.sort_values("Salary", ascending=False).head(5)

    Question:
    How many employees are in HR?

    Output:
    len(df[df["Department"] == "HR"])

    Question:
    Average salary by department

    Output:
    df.groupby("Department")["Salary"].mean()

    User Question:
    {question}
    """
    )

    chain = template | model | StrOutputParser()
    try:
        result = chain.invoke({
            "question": question,
            "column_names": column_names
        })
    except Exception as e:
        return {"error":"LLM model cannot be reached due to token limitation. Please provide a new token."}
    else:
        return result

import json
import re as _re


def _parse_sql_chart_json(text):
    """Read the LLM's JSON answer. Falls back to 'plain SQL, no charts'."""
    if not isinstance(text, str):
        return {"sql": "", "charts": []}
    cleaned = text.strip().replace("```json", "").replace("```sql", "").replace("```", "").strip()
    if "INVALID_QUESTION" in cleaned.upper() and "{" not in cleaned:
        return {"sql": "INVALID_QUESTION", "charts": []}
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            data = json.loads(cleaned[start:end + 1])
            sql = str(data.get("sql", "")).strip()
            charts = data.get("charts") if isinstance(data.get("charts"), list) else []
            return {"sql": sql, "charts": charts}
        except (ValueError, AttributeError):
            pass
   
    if _re.match(r"^\s*(with|select)\b", cleaned, _re.I):
        return {"sql": cleaned, "charts": []}
    return {"sql": "", "charts": []}


def generate_sql_with_chart(question):

    model = init_chat_model(
        "groq:openai/gpt-oss-120b"
    )

    template = PromptTemplate(
    input_variables=["question", "schema"],
    template="""
        You are an expert SQL generator and data-visualisation assistant.

        Convert the user's natural language question into ONE valid SQL query,
        and suggest which chart(s) best represent the result.

        Database dialect: PostgreSQL

        Database schema:
        {schema}

        SQL rules:
        1. Use only tables and columns present in the schema. Never invent columns.
        2. Generate only SELECT queries (no INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE).
        3. Correctly use JOIN, GROUP BY, ORDER BY, aggregate functions and subqueries when required.
        4. Give every computed column a clear snake_case alias (e.g. employee_count, avg_salary, hire_year).
        5. For time-based questions, return one row per period ordered by the period
        (for years use EXTRACT(YEAR FROM ...)::int AS <name>_year).
        6. Ranking questions ("highest", "lowest", "top N", "second highest/lowest"):
        - If a history table exists for the entity in question (e.g. salary history
            with effective_from), use ROW_NUMBER() OVER (PARTITION BY entity_id
            ORDER BY effective_from DESC) to isolate only each entity's latest record
            before ranking. Do not apply this if no history table is involved.
        - Use DISTINCT when ranking values to avoid duplicates from the same entity.
        - Use ORDER BY with LIMIT/OFFSET for "Nth highest/lowest" questions.

        Chart rules (the "charts" list):
        - Each chart is an object: type, x, y, reason.
        "x" and "y" MUST be exact column aliases from your SELECT. "y" must be numeric.
        "reason" is a short phrase (max 8 words).
        - Change over time (years, months, dates) -> "line". Add "bar" too if there
        are only a few periods.
        - Comparing categories (departments, cities, roles) -> "bar".
        - Parts of a whole / share / breakdown / count per category with 6 or fewer
        categories -> also "pie". Never use "pie" for averages, percentages or rates.
        - Single value, one row, or a plain list of records (names, details) -> [] (table only).
        - Put the best chart first. Include every chart that is genuinely suitable.
        - If the user explicitly asks for a chart type (pie, bar, line), put that chart
        FIRST in the list, even if another chart would normally be preferred.

        Output format:
        Return ONLY a raw JSON object — no markdown, no ```json fences, no explanation:
        {{"sql": "<the SQL query>", "charts": [{{"type": "bar", "x": "<column>", "y": "<column>", "reason": "<short phrase>"}}]}}

        If the user input is NOT a clear question that can be answered from this schema
        (greetings like "ok", "hi", "thanks", random words, meaningless text, or data
        that does not exist in the schema), return exactly:
        {{"sql": "INVALID_QUESTION", "charts": []}}

        ### Examples

        User question: "Find the second highest salary with employee details"
        {{"sql": "WITH latest_salary AS (SELECT s.employee_id, s.amount, ROW_NUMBER() OVER (PARTITION BY s.employee_id ORDER BY s.effective_from DESC) AS rn FROM salary s) SELECT e.id, e.name, e.hire_date, e.manager_id, e.dept_id, ls.amount AS salary_amount FROM latest_salary ls JOIN employee e ON e.id = ls.employee_id WHERE ls.rn = 1 AND ls.amount = (SELECT DISTINCT amount FROM latest_salary WHERE rn = 1 ORDER BY amount DESC OFFSET 1 LIMIT 1);", "charts": []}}

        User question: "Show employees by department"
        {{"sql": "SELECT d.name AS department_name, COUNT(e.id) AS employee_count FROM employee e JOIN department d ON e.dept_id = d.id GROUP BY d.name;", "charts": [{{"type": "pie", "x": "department_name", "y": "employee_count", "reason": "breakdown across few categories"}}, {{"type": "bar", "x": "department_name", "y": "employee_count", "reason": "compare category sizes"}}]}}

        User question: "Which city has the most employees?"
        {{"sql": "SELECT a.city AS city, COUNT(DISTINCT e.id) AS employee_count FROM address a JOIN employee e ON e.address_id = a.id GROUP BY a.city ORDER BY employee_count DESC LIMIT 1;", "charts": []}}

        User question:
        {question}
        """
        )
    chain = template | model | StrOutputParser()
    try:
        result = chain.invoke({
            "question": question,
            "schema": database_schema
        })
    except Exception as e:
        return {"error": "LLM model cannot be reached due to token limitation. Please provide a new token."}
    else:
        return _parse_sql_chart_json(result)
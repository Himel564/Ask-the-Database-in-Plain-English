import os
import ast
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response  
from pydantic import BaseModel
import pandas as pd

import io
from database.db_job import execute_query
from backend.llm_model import generate_response, load_and_index_pdf, query_pdf_context,generate_pandas_query
from backend.evaluation import evaluate_queries
from backend.multilingual import transcribe_audio, reply_in_user_language, text_to_speech 
from backend.llm_model import generate_sql_with_chart  
from backend.chart_selector import select_charts  
app = FastAPI(title="QueryAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


INVALID_SQL_MESSAGE = (
    "Sorry, I couldn't understand that as a question about your database. "
    "Please try again with a clear question, for example: "
    "\"Give the number of employees in the company\" or "
    "\"Find the second highest salary with employee details\"."
)

INVALID_EXCEL_MESSAGE = (
    "Sorry, I couldn't understand that as a question about your spreadsheet. "
    "Please try again with a clear question about its columns, for example: "
    "\"Show the first 10 rows\" or \"Find the row with the highest value\"."
)


def _is_invalid(text):
    return isinstance(text, str) and "INVALID_QUESTION" in text.upper()


class QuestionRequest(BaseModel):
    question: str


class QueryRequest(BaseModel):
    query: str


class PdfQuestionRequest(BaseModel):
    question: str
    file_id: str | None = None


class EvaluateRequest(BaseModel):
    question: str
    generated_sql: str
    actual_sql: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert_to_sql")
def convert_to_sql(request: QuestionRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question is empty.")
    try:
        sql = generate_response(request.question)
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Could not generate SQL: {e}")
    if _is_invalid(sql):  # FIX: meaningless / unrelated input
        raise HTTPException(status_code=400, detail=INVALID_SQL_MESSAGE)
    return {"sql": sql}


@app.post("/ask_with_chart")
def ask_with_chart(request: QuestionRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty.")
    try:
        out = generate_sql_with_chart(question)
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Could not generate SQL: {e}")
    if isinstance(out, dict) and "error" in out:
        raise HTTPException(status_code=500, detail=f"Could not generate SQL: {out['error']}")

    sql = (out.get("sql") or "").strip()
    if not sql or _is_invalid(sql):
        raise HTTPException(status_code=400, detail=INVALID_SQL_MESSAGE)

    result = execute_query(sql)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    rows = result if isinstance(result, list) else []
    columns = list(rows[0].keys()) if rows else []
    charts = select_charts(out.get("charts"), columns, rows, question)  
    return {"sql": sql, "columns": columns, "rows": rows, "charts": charts}


@app.post("/execute_query")
def run_sql(request: QueryRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query is empty.")
    result = execute_query(request.query)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/upload_pdf")
async def upload_pdf_file(file: UploadFile = File(...)):
    temp_file_path = f"temp_{file.filename}"
    
    with open(temp_file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    result = load_and_index_pdf(temp_file_path)
    os.remove(temp_file_path)
    
    return result


@app.post("/ask_pdf")
async def ask_pdf_question(request: PdfQuestionRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question is empty.")
    answer = query_pdf_context(request.question)
    return {"answer": answer}


app.state.df = None
@app.post("/upload_excel")
async def read_excel_data(file: UploadFile = File(...)):

    try:
        # Check file type
        allowed_extensions = [".xlsx", ".xls", ".csv"]
        filename = file.filename or ""
        extension = Path(filename).suffix.lower()

        if extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail="Please upload an Excel file (.xlsx or .xls) or a CSV file (.csv)"
            )

        contents = await file.read()
        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty"
            )

        if extension == ".csv":
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl" if extension == ".xlsx" else "xlrd")


        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="The uploaded Excel file is empty"
            )

        app.state.df = df

        
        column_name = df.columns.tolist()

        return {
            "message": "File loaded successfully",
            "filename": filename,
            "columns": column_name,
            "rows": len(df)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"File not loaded: {str(e)}"
        )


class QueryRequest(BaseModel):
    query: str


@app.post("/ask_excel")
async def process_query(request: PdfQuestionRequest):

    
    if app.state.df is None:
        raise HTTPException(
            status_code=400,
            detail="Please upload an Excel file first"
        )

    try:
        
        df = app.state.df

        column_name = df.columns.tolist()

        question = request.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is empty.")

        pandas_query = generate_pandas_query(
            question,
            column_name
        )
        if isinstance(pandas_query, dict) and "error" in pandas_query:
            raise HTTPException(status_code=500, detail=pandas_query["error"])
        if _is_invalid(pandas_query):  # FIX: meaningless / unrelated input
            raise HTTPException(status_code=400, detail=INVALID_EXCEL_MESSAGE)

        return {
            "question": question,
            "columns": column_name,
            "query": pandas_query,
            "pandas_query": pandas_query
        }

    except HTTPException:  
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating pandas query: {str(e)}"
        )


class ExcelQueryRequest(BaseModel):
    query: str
    file_id: str | None = None


class _SafePandasExpression(ast.NodeVisitor):
    """Allow generated DataFrame expressions without allowing arbitrary code."""

    allowed_nodes = (
        ast.Expression, ast.Load, ast.Name, ast.Constant, ast.Subscript,
        ast.Attribute, ast.Call, ast.keyword, ast.BinOp, ast.BoolOp,
        ast.Compare, ast.UnaryOp, ast.And, ast.Or, ast.Add, ast.Sub,
        ast.Mult, ast.Div, ast.Mod, ast.Eq, ast.NotEq, ast.Gt, ast.GtE,
        ast.Lt, ast.LtE, ast.Not, ast.USub, ast.UAdd, ast.List, ast.Tuple,
        ast.Dict, ast.Slice,
    )

    def generic_visit(self, node):
        if not isinstance(node, self.allowed_nodes):
            raise ValueError(f"Unsupported expression element: {type(node).__name__}")
        super().generic_visit(node)

    def visit_Name(self, node):
        if node.id not in {"df", "len"}:
            raise ValueError(f"Unknown name: {node.id}")

    def visit_Attribute(self, node):
        if node.attr.startswith("_"):
            raise ValueError("Private attributes are not allowed")
        self.generic_visit(node)


@app.post("/execute_excel_query")
async def execute_excel_query(request: ExcelQueryRequest):
    if app.state.df is None:
        raise HTTPException(status_code=400, detail="Please upload an Excel file first")
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query is empty.")

    try:
        expression = request.query.strip().replace("```python", "").replace("```", "").strip()
        tree = ast.parse(expression, mode="eval")
        _SafePandasExpression().visit(tree)
        result = eval(compile(tree, "<pandas-query>", "eval"), {"__builtins__": {}}, {
            "df": app.state.df,
            "len": len,
        })

        if isinstance(result, pd.DataFrame):
            return {"columns": result.columns.tolist(), "rows": result.where(result.notna(), None).to_dict(orient="records")}
        if isinstance(result, pd.Series):
            return {"columns": [result.name or "value"], "rows": result.where(result.notna(), None).to_frame().reset_index(drop=True).to_dict(orient="records")}
        return {"columns": ["value"], "rows": [{"value": result}]}
    except (SyntaxError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid Pandas query: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not execute Pandas query: {e}")


@app.post("/evaluate_sql")
def evaluate_sql(request: EvaluateRequest):
    if not request.generated_sql.strip():
        raise HTTPException(status_code=400, detail="Generate a SQL query first.")
    if not request.actual_sql.strip():
        raise HTTPException(status_code=400, detail="Enter the correct SQL query to compare against.")
    try:
        result = evaluate_queries(request.question, request.generated_sql, request.actual_sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not evaluate the queries: {e}")
    return result

class ReplyRequest(BaseModel):
    question: str
    information: str


@app.post("/transcribe_audio")
async def transcribe_audio_file(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio received.")
    try:
        text = transcribe_audio(audio_bytes, file.filename or "voice.webm")
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Could not understand the audio: {e}")
    return {"text": text}


@app.post("/reply_in_user_language")
def reply_in_language(request: ReplyRequest):
    try:
        answer = reply_in_user_language(request.question, request.information)
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Could not create the answer: {e}")
    return {"answer": answer}


class SpeakRequest(BaseModel):
    text: str
    language: str  


@app.post("/speak_text")
def speak_text(request: SpeakRequest):
    if request.language not in ("bn", "hi"):
        raise HTTPException(status_code=400, detail="Only Bengali (bn) and Hindi (hi) are supported.")
    try:
        audio = text_to_speech(request.text, request.language)
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Could not create the voice: {e}")
    return Response(content=audio, media_type="audio/mpeg")
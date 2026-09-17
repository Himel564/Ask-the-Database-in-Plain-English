import os
import ast
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd

import io
from database.db_job import execute_query
from backend.llm_model import generate_response, load_and_index_pdf, query_pdf_context,generate_pandas_query
from backend.evaluation import evaluate_queries

app = FastAPI(title="QueryAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {"sql": sql}


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

        # Read uploaded file
        contents = await file.read()
        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty"
            )

        # Select the parser based on the actual file extension. Excel files
        # cannot be parsed by read_csv, which caused upload failures for .xlsx.
        if extension == ".csv":
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl" if extension == ".xlsx" else "xlrd")


        # Check if file contains data
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="The uploaded Excel file is empty"
            )

        # Store dataframe
        app.state.df = df

        # Get column names
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

    # Check whether Excel file is uploaded
    if app.state.df is None:
        raise HTTPException(
            status_code=400,
            detail="Please upload an Excel file first"
        )

    try:
        # Get dataframe
        df = app.state.df

        # Get column names
        column_name = df.columns.tolist()

        # Call your already-written function
        question = request.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is empty.")

        pandas_query = generate_pandas_query(
            question,
            column_name
        )
        if isinstance(pandas_query, dict) and "error" in pandas_query:
            raise HTTPException(status_code=500, detail=pandas_query["error"])

        return {
            "question": question,
            "columns": column_name,
            "query": pandas_query,
            "pandas_query": pandas_query
        }

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
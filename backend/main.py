from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database.db_job import execute_query
from backend.llm_model import generate_response  # your function: takes question (str), returns SQL (str)

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
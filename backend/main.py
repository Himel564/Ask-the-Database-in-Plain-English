import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database.db_job import execute_query
from backend.llm_model import generate_response, load_and_index_pdf, query_pdf_context

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
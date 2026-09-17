from database.db_schemas import database_schema
import os
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser
from langchain_community.document_loaders import PDFPlumberLoader
import pdfplumber


load_dotenv(r"backend\.env")

# In-memory store for the most recently uploaded PDF's extracted content.
# Simple single-document cache: fine for this app since only one PDF is
# active at a time (matches the existing /api/upload-pdf -> /api/ask-pdf flow).
_pdf_store = {"filename": None, "context": None, "pages": 0}

# Keep the prompt within a safe size for the model's context window.
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
        # 1. LangChain doc loader loads the PDF (one Document per page).
        loader = PDFPlumberLoader(file_path)
        documents = loader.load()

        # 2. Pull out tabular data page-by-page and merge it into that
        #    page's content, so tables aren't lost in plain text extraction.
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

    # Guard against overly long prompts.
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
    6. For "highest", "lowest", "maximum" or "minimum" questions, generate logically correct SQL.
    7. Return ONLY the SQL query.
    8. Do not use markdown.
    9. Do not include explanations.

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
        return {"error":str(e)}
    else:
        return result
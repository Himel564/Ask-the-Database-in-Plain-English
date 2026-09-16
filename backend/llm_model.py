from database.db_schemas import database_schema
import os
from dotenv import load_dotenv

from langchain_core.prompts import PromptTemplate
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser


load_dotenv(r"backend\.env")
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
        return {"error":e}
    else:
        return result

# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app

# Copy requirements.txt from root (parent folder of backend)
COPY ../requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
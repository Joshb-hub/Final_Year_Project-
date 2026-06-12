FROM python:3.10-slim

# Prevent Python from writing .pyc files and enable buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (needed for FAISS or certain compilation steps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . /app/

# Hugging Face Spaces run on port 7860
EXPOSE 7860

# Run FastAPI web app using uvicorn on port 7860
CMD ["python", "-m", "uvicorn", "web_app:app", "--host", "0.0.0.0", "--port", "7860"]

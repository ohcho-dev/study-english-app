FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (FFmpeg for pydub audio conversion)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry
RUN poetry config virtualenvs.create false

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies (without dev dependencies)
RUN poetry install --without dev --no-interaction --no-ansi

# Copy application code
COPY app ./app
COPY scripts ./scripts
COPY migrations ./migrations
COPY alembic.ini ./

# Create static directory for TTS audio files
RUN mkdir -p static/audio

# Cloud Run uses PORT environment variable (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "alembic upgrade head && python -m scripts.init_access_control && uvicorn app.main:app --host 0.0.0.0 --port $PORT"]

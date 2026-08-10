FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies if required for some packages (like psycopg)
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Run as non-root user
RUN useradd -m appuser
USER appuser

COPY app ./app
COPY haarcascade_frontalface_default.xml ./haarcascade_frontalface_default.xml

EXPOSE 8000

COPY start.sh ./start.sh
USER root
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh && chown -R appuser:appuser /app
USER appuser

# Execute the unified startup script
CMD ["./start.sh"]
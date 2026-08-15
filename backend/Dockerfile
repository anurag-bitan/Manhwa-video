FROM python:3.10-slim

# Install all required system dependencies (including OpenGL for OpenCV)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libfontconfig1 \
    libjpeg62-turbo \
    libpng16-16 \
    libgl1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first (caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install PaddlePaddle and PaddleOCR (using fast mirror, longer timeout)
RUN pip install paddlepaddle==2.6.2 -i https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install paddleocr==2.7.3 -i https://pypi.tuna.tsinghua.edu.cn/simple --default-timeout=300

# Copy the rest of the backend code
COPY . .

# Run the Celery worker
CMD ["celery", "-A", "core.celery_app", "worker", "--loglevel=info", "--pool=solo"]

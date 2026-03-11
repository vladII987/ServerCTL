FROM python:3.12-slim
RUN apt-get update && apt-get install -y curl iputils-ping && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ARG APP_VERSION=dev
RUN echo "$APP_VERSION" > /app/VERSION
EXPOSE 9090
CMD ["python", "main.py"]

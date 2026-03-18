FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    freerdp2-x11 \
    tigervnc-standalone-server \
    python3 \
    python3-pip \
    libx11-6 libxext6 libxinerama1 libxcursor1 libxv1 \
    libxkbfile1 libxrandr2 libxi6 libxrender1 libxfixes3 \
    dbus-x11 xfonts-base \
    && pip3 install --no-cache-dir --break-system-packages "websockets==13.1" \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY manager.py .

EXPOSE 8080
CMD ["python3", "manager.py"]

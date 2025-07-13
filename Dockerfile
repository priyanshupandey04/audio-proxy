FROM node:18-slim

# Install Python3, ffmpeg, curl + create a venv for yt-dlp
RUN apt-get update && \
    apt-get install -y \
      python3 \
      python3-venv \
      python-is-python3 \
      ffmpeg \
      curl && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install yt-dlp && \
    ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install npm deps (yt-dlp-exec will use our venv yt-dlp)
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

EXPOSE 8080
CMD ["npm", "start"]

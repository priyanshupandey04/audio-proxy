FROM node:18-slim

# Install Python3 (with a "python" shim), ffmpeg and yt-dlp
RUN apt-get update && \
    apt-get install -y \
      python3 \
      python3-venv \
      python-is-python3 \
      ffmpeg \
      curl \
      yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install npm deps
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

EXPOSE 8080
CMD ["npm", "start"]

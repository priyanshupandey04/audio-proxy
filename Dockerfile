FROM node:18-slim

# Install Python, venv support, and ffmpeg
RUN apt-get update && \
    apt-get install -y \
      python3 \
      python3-venv \
      python-is-python3 \
      ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Create and populate a virtualenv with yt-dlp
RUN python3 -m venv /opt/ytenv && \
    /opt/ytenv/bin/pip install --no-cache-dir yt-dlp

# Symlink the venv yt-dlp into PATH
RUN ln -s /opt/ytenv/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

# Copy and install Node.js dependencies
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 10000
CMD ["npm", "start"]

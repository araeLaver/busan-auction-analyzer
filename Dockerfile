# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Puppeteer 실행을 위한 필수 패키지 및 한글 폰트 설치
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn

# Puppeteer가 로컬 Chromium을 사용하도록 환경변수 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install app dependencies
COPY package*.json ./

# npm install 실행 (production 모드 권장)
RUN npm install --omit=dev

# Copy app source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD [ "npm", "start" ]
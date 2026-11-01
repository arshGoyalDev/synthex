FROM synthex/base:latest

RUN apk add --no-cache nodejs npm
RUN npm install --global pnpm yarn

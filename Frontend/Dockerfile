FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

FROM nginx:1.27-alpine
COPY --from=builder /app/src /usr/share/nginx/html
EXPOSE 80

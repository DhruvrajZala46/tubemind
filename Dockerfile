FROM node:20
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV WORKER_MODE=true
EXPOSE 8080
CMD ["node", "dist/worker/extract.js"] 
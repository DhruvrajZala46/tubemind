FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "dist/worker/extract.js"] 
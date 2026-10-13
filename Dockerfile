FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV CORE_PORT=3001

EXPOSE 3000
CMD ["npm", "start"]

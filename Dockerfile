FROM node:18.15-alpine

RUN mkdir -p /app

WORKDIR /app

COPY ./ .

RUN sed -i "s/open: !isCodeSandbox/open: false/" vite.config.js
RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev"]

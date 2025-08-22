FROM node:18.15-alpine

RUN apk add --no-cache git
RUN git clone https://github.com/scottpetrovic/mesh2motion-app.git /app

WORKDIR /app

RUN sed -i "s/open: !isCodeSandbox/open: false/" vite.config.js
RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev"]

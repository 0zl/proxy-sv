FROM node:18

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 7860
CMD [ "node", "docker.js" ]
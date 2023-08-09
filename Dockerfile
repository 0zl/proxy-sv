FROM node:18

WORKDIR /usr/src/app
RUN git clone https://github.com/0zl/proxy-sv.git .

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 7860
CMD [ "node", "docker.js" ]
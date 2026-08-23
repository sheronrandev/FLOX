FROM node:22-alpine
WORKDIR /app
COPY server/package.json ./package.json
COPY server/src ./src
COPY server/scripts ./scripts
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4174 ACTIVITY_STUDIO_DATA=/data
USER node
EXPOSE 4174
CMD ["node", "src/index.mjs"]

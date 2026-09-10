FROM node:22-alpine
RUN addgroup -S proxy && adduser -S -G proxy proxy
WORKDIR /proxy
COPY proxy.js package.json ./
USER proxy
ENV PORT=3128
EXPOSE 3128
CMD ["node", "proxy.js"]

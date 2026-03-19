FROM node:20-alpine AS build
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
# Download noVNC ESM source into src/novnc/ so Vite bundles it directly
RUN apk add --no-cache wget && \
    wget -qO /tmp/novnc.tar.gz https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.tar.gz && \
    tar -xzf /tmp/novnc.tar.gz -C /tmp && \
    cp -r /tmp/noVNC-1.5.0/core /app/src/novnc && \
    cp -r /tmp/noVNC-1.5.0/vendor /app/src/vendor && \
    rm -rf /tmp/novnc.tar.gz /tmp/noVNC-1.5.0
ARG VITE_API_URL=""
ARG VITE_DASHBOARD_TOKEN="change-me"
ARG VITE_APP_VERSION="dev"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DASHBOARD_TOKEN=$VITE_DASHBOARD_TOKEN
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-ssl.conf /etc/nginx/conf.d/ssl.conf.disabled
ARG BACKEND_PORT=8765
ARG SSL_MODE=none
RUN sed -i "s|\${BACKEND_PORT}|${BACKEND_PORT}|g" /etc/nginx/conf.d/default.conf && \
    sed -i "s|\${BACKEND_PORT}|${BACKEND_PORT}|g" /etc/nginx/conf.d/ssl.conf.disabled
# If SSL_MODE is selfsigned or letsencrypt, swap configs
RUN if [ "$SSL_MODE" != "none" ]; then \
      mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled && \
      mv /etc/nginx/conf.d/ssl.conf.disabled /etc/nginx/conf.d/default.conf; \
    fi
EXPOSE 80 443

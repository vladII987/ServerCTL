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
ARG BACKEND_PORT=8765
RUN sed -i "s|\${BACKEND_PORT}|${BACKEND_PORT}|g" /etc/nginx/conf.d/default.conf
EXPOSE 80

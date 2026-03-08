FROM node:20-alpine AS build
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
ARG VITE_API_URL=""
ARG VITE_DASHBOARD_TOKEN="change-me"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DASHBOARD_TOKEN=$VITE_DASHBOARD_TOKEN
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
ARG BACKEND_PORT=8765
ENV BACKEND_PORT=${BACKEND_PORT}
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

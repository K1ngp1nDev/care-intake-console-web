# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG DEMO_AUTH_DISABLED=false
RUN if [ "$DEMO_AUTH_DISABLED" = "true" ]; then \
  node -e "const fs=require('fs'); const p='src/app/core/demo-auth.ts'; let s=fs.readFileSync(p,'utf8'); s=s.replace('DEMO_AUTH_DISABLED = false', 'DEMO_AUTH_DISABLED = true'); fs.writeFileSync(p,s);" ; \
  fi
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/care-intake-console-web/browser /usr/share/nginx/html

EXPOSE 80

FROM node:22-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ENV REACT_APP_API_BASE_URL=/api/
RUN npm run build

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.cloud_settings DJANGO_LOAD_ENV_FILE=False
WORKDIR /app
COPY backend/requirements-production.txt backend/requirements-cloud.txt ./
RUN pip install --no-cache-dir -r requirements-cloud.txt
COPY backend/ ./
COPY --from=frontend /frontend/build ./frontend_build
COPY deploy/cloud/start.sh /start.sh
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser
CMD ["sh", "/start.sh"]

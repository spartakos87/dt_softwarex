FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements*.txt ./
ARG INSTALL_ML=0
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_ML" = "1" ]; then pip install --no-cache-dir -r requirements-ml.txt; fi
COPY . .
EXPOSE 7781
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7781"]

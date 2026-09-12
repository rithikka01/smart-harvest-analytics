FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
COPY . .
ENV PORT=8001
EXPOSE 8001
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]

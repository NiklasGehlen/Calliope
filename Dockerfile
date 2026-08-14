FROM python:3.13-slim

WORKDIR /app

RUN pip install flask

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
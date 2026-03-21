"""
AWS Lambda entrypoint for the FastAPI AI service.
"""
from mangum import Mangum

from app import app


handler = Mangum(app, lifespan="off")

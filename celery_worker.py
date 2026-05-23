from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Celery
def make_celery(app_name=__name__):
    # Retrieve Redis URL from environment or fallback to localhost
    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    
    return Celery(
        app_name,
        backend=redis_url,
        broker=redis_url
    )

celery = make_celery()

# Import tasks to ensure they are registered
import tasks

from dotenv import load_dotenv
load_dotenv()

from celery import Celery
from core.config import settings



celery_app = Celery(
    "manhwa_video",
    broker=settings.celery_broker_url,
    backend=settings.celery_broker_url,  # using Redis also for results
)

# Optional: configure task serialization
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

import workers.tasks
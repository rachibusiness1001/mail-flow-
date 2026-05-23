from celery_worker import celery
import time
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

@celery.task(bind=True, max_retries=3)
def send_email_task(self, smtp_host, smtp_port, email, password, to_email, subject, body):
    try:
        msg = MIMEMultipart()
        msg['From'] = email
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(email, password)
        server.send_message(msg)
        server.quit()
        
        return {"status": "success", "to": to_email}
    except Exception as exc:
        # Retry in 60 seconds if sending fails
        raise self.retry(exc=exc, countdown=60)

@celery.task(bind=True)
def poll_imap_task(self, imap_host, email, password):
    # This task will connect to IMAP, read replies, and update the database.
    # In a real app, this should import the Flask app context.
    pass

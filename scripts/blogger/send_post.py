import argparse
import sys
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def _required_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

def send_post(title, html_body):
    sender_email = _required_env("BLOGGER_SMTP_USER")
    app_password = _required_env("BLOGGER_SMTP_APP_PASSWORD")
    blogger_email = os.environ.get("BLOGGER_EMAIL_TARGET", "sig.noise.decoder.procore@blogger.com")
    
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = blogger_email
    msg['Subject'] = title
    
    msg.attach(MIMEText(html_body, 'html'))
    
    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, app_password)
        text = msg.as_string()
        server.sendmail(sender_email, blogger_email, text)
        server.quit()
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED: {str(e)}")
        raise SystemExit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Preview or explicitly publish a Blogger email draft")
    parser.add_argument("title")
    parser.add_argument("body_file", help="UTF-8 HTML file containing the draft")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--approved", action="store_true")
    args = parser.parse_args()
    with open(args.body_file, encoding="utf-8") as handle:
        body = handle.read()
    if "https://www.carkey.com.tw/" not in body:
        parser.error("draft must link back to the canonical website")
    if not (args.publish and args.approved):
        print("DRY RUN: draft validated; add both --publish and --approved after explicit approval")
        sys.exit(0)
    send_post(args.title, body)

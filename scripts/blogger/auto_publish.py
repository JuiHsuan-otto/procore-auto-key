import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import urllib.request
import os

def send_post(title, html_body, img_path_or_url):
    sender_email = "ottoyeh@gmail.com"
    app_password = "mzvk msyj irdm oeex".replace(" ", "")
    blogger_email = "sig.noise.decoder.procore@blogger.com"
    
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = blogger_email
    msg['Subject'] = title
    
    msg.attach(MIMEText(html_body, 'html'))
    
    if img_path_or_url:
        try:
            if img_path_or_url.startswith("http"):
                req = urllib.request.Request(img_path_or_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    img_data = response.read()
            else:
                with open(img_path_or_url, 'rb') as f:
                    img_data = f.read()
                    
            image = MIMEImage(img_data, name="featured_image.jpg")
            msg.attach(image)
            print("Attached image successfully.")
        except Exception as e:
            print(f"Warning: Failed to attach image: {e}")
    
    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, app_password)
        server.sendmail(sender_email, blogger_email, msg.as_string())
        server.quit()
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python auto_publish.py <title> <body> [img_path_or_url]")
        sys.exit(1)
    
    title = sys.argv[1]
    body = sys.argv[2]
    img = sys.argv[3] if len(sys.argv) > 3 else None
    
    send_post(title, body, img)
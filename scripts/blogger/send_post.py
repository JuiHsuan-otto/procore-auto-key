import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_post(title, html_body):
    sender_email = "ottoyeh@gmail.com"
    app_password = "mzvk msyj irdm oeex".replace(" ", "")
    blogger_email = "sig.noise.decoder.procore@blogger.com"
    
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

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python send_post.py <title> <body>")
        sys.exit(1)
    
    title = sys.argv[1]
    body = sys.argv[2]
    send_post(title, body)
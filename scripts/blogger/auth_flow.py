import os
import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/blogger']

def main():
    creds = None
    token_path = 'scripts/blogger/token.json'
    secret_path = 'scripts/blogger/client_secret.json'

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(secret_path, SCOPES)
            # Do NOT open browser automatically, print URL instead
            creds = flow.run_local_server(port=8080, open_browser=False)
            
        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    print("AUTHORIZATION_SUCCESSFUL")

if __name__ == '__main__':
    main()
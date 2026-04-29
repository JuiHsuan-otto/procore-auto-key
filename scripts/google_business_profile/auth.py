#!/usr/bin/env python3
"""Authorize Google Business Profile access and store the token locally."""

from __future__ import annotations

import json

from google_auth_oauthlib.flow import InstalledAppFlow

from common import CLIENT_SECRET_PATH, SCOPES, TOKEN_PATH, save_json


def main() -> None:
    if not CLIENT_SECRET_PATH.exists():
        raise SystemExit(f"Missing client secret JSON: {CLIENT_SECRET_PATH}")
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_PATH), scopes=SCOPES)
    credentials = flow.run_local_server(
        port=0,
        access_type="offline",
        prompt="consent",
        open_browser=True,
    )
    save_json(TOKEN_PATH, json.loads(credentials.to_json()))
    print(f"TOKEN_SAVED={TOKEN_PATH}")
    print("SCOPE=business.manage")


if __name__ == "__main__":
    main()

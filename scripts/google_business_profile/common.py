"""Shared helpers for Google Business Profile scripts."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

ROOT = Path(__file__).resolve().parents[2]
SCOPES = ["https://www.googleapis.com/auth/business.manage"]
CLIENT_SECRET_PATH = Path(os.environ.get("GBP_CLIENT_SECRET_FILE", ROOT / "secrets" / "google-business-profile-client.json"))
TOKEN_PATH = Path(os.environ.get("GBP_TOKEN_FILE", ROOT / "secrets" / "google-business-profile-token.json"))
LOCATION_CONFIG_PATH = Path(os.environ.get("GBP_LOCATION_CONFIG", ROOT / "secrets" / "google-business-profile-location.json"))


class GbpError(RuntimeError):
    """Raised when Google Business Profile setup or API calls fail."""


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_credentials() -> Credentials:
    if not TOKEN_PATH.exists():
        raise GbpError(
            "Missing OAuth token. Run: python scripts/google_business_profile/auth.py"
        )
    credentials = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        save_json(TOKEN_PATH, json.loads(credentials.to_json()))
    if not credentials.valid:
        raise GbpError(
            "OAuth token is not valid. Delete secrets/google-business-profile-token.json and run auth.py again."
        )
    return credentials


def headers() -> dict[str, str]:
    credentials = load_credentials()
    return {
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json; charset=utf-8",
    }


def request_json(method: str, url: str, **kwargs: Any) -> Any:
    response = requests.request(method, url, headers=headers(), timeout=30, **kwargs)
    if response.status_code >= 400:
        raise GbpError(f"Google API error {response.status_code}: {response.text[:1200]}")
    if not response.text:
        return {}
    return response.json()


def normalize_account_location(account: str, location: str) -> tuple[str, str]:
    account_name = account if account.startswith("accounts/") else f"accounts/{account}"
    location_id = location.split("/")[-1]
    return account_name, f"{account_name}/locations/{location_id}"


def load_location_config() -> tuple[str, str]:
    if not LOCATION_CONFIG_PATH.exists():
        raise GbpError(
            "Missing location config. Run list_locations.py and save the right account/location first."
        )
    data = load_json(LOCATION_CONFIG_PATH)
    account = data.get("account") or data.get("accountName")
    location = data.get("location") or data.get("locationName")
    if not account or not location:
        raise GbpError("Location config must include account and location.")
    return normalize_account_location(account, location)

#!/usr/bin/env python3
"""List Google Business Profile accounts and locations."""

from __future__ import annotations

import argparse

from common import LOCATION_CONFIG_PATH, request_json, save_json

ACCOUNT_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
LOCATION_URL = "https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations"
READ_MASK = "name,title,storefrontAddress,metadata,websiteUri,phoneNumbers"


def list_accounts() -> list[dict]:
    data = request_json("GET", ACCOUNT_URL)
    return data.get("accounts", [])


def list_locations(account_name: str) -> list[dict]:
    url = LOCATION_URL.format(account=account_name)
    data = request_json("GET", url, params={"readMask": READ_MASK})
    return data.get("locations", [])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--save-first", action="store_true", help="Save the first returned location as default config.")
    args = parser.parse_args()

    accounts = list_accounts()
    print(f"ACCOUNTS={len(accounts)}")
    saved = False
    for account in accounts:
        account_name = account.get("name", "")
        print(f"ACCOUNT {account_name} displayName={account.get('accountName', '')} type={account.get('type', '')}")
        locations = list_locations(account_name)
        print(f"LOCATIONS {account_name}={len(locations)}")
        for location in locations:
            title = location.get("title", "")
            location_name = location.get("name", "")
            address = location.get("storefrontAddress", {})
            region = address.get("administrativeArea", "")
            locality = address.get("locality", "")
            print(f"LOCATION {location_name} title={title} area={region}{locality}")
            if args.save_first and not saved:
                save_json(
                    LOCATION_CONFIG_PATH,
                    {
                        "account": account_name,
                        "location": location_name,
                        "title": title,
                        "source": "list_locations.py --save-first",
                    },
                )
                print(f"LOCATION_CONFIG_SAVED={LOCATION_CONFIG_PATH}")
                saved = True


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Create or dry-run a Google Business Profile local post from a draft payload."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import load_location_config, normalize_account_location, request_json


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    required = ["languageCode", "summary", "topicType", "callToAction"]
    missing = [key for key in required if key not in payload]
    if missing:
        raise SystemExit(f"Payload missing required fields: {', '.join(missing)}")
    if payload.get("topicType") != "STANDARD":
        raise SystemExit("Only STANDARD posts are allowed by this automation.")
    cta = payload.get("callToAction", {})
    if cta.get("actionType") != "LEARN_MORE":
        raise SystemExit("CTA must be LEARN_MORE.")
    if not cta.get("url", "").startswith("https://www.carkey.com.tw/"):
        raise SystemExit("CTA URL must point to carkey.com.tw.")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("payload", help="Path to google-business-profile.json draft payload.")
    parser.add_argument("--account", default="", help="Account id or accounts/{id}. Defaults to saved config.")
    parser.add_argument("--location", default="", help="Location id or locations/{id}. Defaults to saved config.")
    parser.add_argument("--publish", action="store_true", help="Actually publish the local post.")
    parser.add_argument("--approved", action="store_true", help="Required together with --publish.")
    args = parser.parse_args()

    payload = load_payload(Path(args.payload))
    if args.account and args.location:
        account_name, parent = normalize_account_location(args.account, args.location)
    else:
        account_name, parent = load_location_config()
    url = f"https://mybusiness.googleapis.com/v4/{parent}/localPosts"

    print("GBP_PAYLOAD_READY=1")
    print(f"ACCOUNT={account_name}")
    print(f"PARENT={parent}")
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    if not args.publish:
        print("DRY_RUN=1")
        return
    if not args.approved:
        raise SystemExit("Refusing to publish without --approved")

    result = request_json("POST", url, json=payload)
    print("GBP_POST_PUBLISHED=1")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

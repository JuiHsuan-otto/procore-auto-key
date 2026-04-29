# Google Business Profile Tools

Local tools for ProCore Google Business Profile OAuth, location discovery, and local post publishing.

These scripts never commit credentials. OAuth client JSON, token JSON, and selected location config live under `secrets/`.

## 1. Authorize

```bash
python scripts/google_business_profile/auth.py
```

This opens a Google login page and stores the token at:

```text
secrets/google-business-profile-token.json
```

If Google shows `403: access_denied` and says the app has not completed verification, add the Google account that manages the Business Profile as a test user in Google Cloud:

```text
Google Cloud Console -> Google Auth Platform / OAuth consent -> Audience -> Test users
```

Then run `auth.py` again. This is expected while the OAuth app is in testing mode.

## 2. List Accounts And Locations

```bash
python scripts/google_business_profile/list_locations.py
```

Save the first returned location as the default config:

```bash
python scripts/google_business_profile/list_locations.py --save-first
```

## 3. Dry-Run A Local Post

```bash
python scripts/google_business_profile/publish_local_post.py drafts/YYYY-MM-DD-slug/google-business-profile.json
```

## 4. Publish After Explicit Approval

```bash
python scripts/google_business_profile/publish_local_post.py drafts/YYYY-MM-DD-slug/google-business-profile.json --publish --approved
```

Only use publish mode after Meico explicitly approves Google Business Profile posting for that content.

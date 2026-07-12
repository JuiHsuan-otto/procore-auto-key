# Blogger Draft Sender

External publishing is opt-in. Prepare a UTF-8 HTML draft containing a link to the canonical website, then preview it:

```bash
python scripts/blogger/auto_publish.py "標題" draft.html
```

The default performs no network request. Only after explicit approval may an operator add both `--publish --approved`. Credentials must stay in environment variables; never commit them.

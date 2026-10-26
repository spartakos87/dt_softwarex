"""Create a one-off local demo environment; never commit the resulting .env."""
from pathlib import Path
import secrets

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'.env'
TEMPLATE=ROOT/'.env.example'
if TARGET.exists():
    raise SystemExit('.env exists; refusing to overwrite your credentials')
text=TEMPLATE.read_text()
values={
    'DB_PASSWORD':secrets.token_urlsafe(30),
    'JWT_SECRET':secrets.token_urlsafe(48),
    'DEMO_PASSWORD':secrets.token_urlsafe(15),
}
for k,v in values.items():
    text=text.replace(f'{k}=SET_BY_SCRIPT',f'{k}={v}')
TARGET.write_text(text)
try: TARGET.chmod(0o600)
except OSError: pass
print('Created a private .env file. Demo login: demo; password is DEMO_PASSWORD in .env.')

"""Versioned, salted PBKDF2-HMAC password hashes using Python's standard library."""
import base64
import hashlib
import hmac
import secrets

ITERATIONS = 310_000

def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError('Passwords must be at least 12 characters')
    salt=secrets.token_bytes(16)
    raw=hashlib.pbkdf2_hmac('sha256',password.encode(),salt,ITERATIONS)
    return 'pbkdf2_sha256${}${}${}'.format(
        ITERATIONS,
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(raw).decode()
    )

def verify_password(password: str, stored: str) -> bool:
    try:
        name,rounds,salt_b64,key_b64=stored.split('$')
        if name!='pbkdf2_sha256': return False
        n=int(rounds)
        if n<100_000 or n>2_000_000: return False
        salt=base64.urlsafe_b64decode(salt_b64)
        key=base64.urlsafe_b64decode(key_b64)
        computed=hashlib.pbkdf2_hmac('sha256',password.encode(),salt,n)
        return hmac.compare_digest(computed,key)
    except (ValueError, TypeError, OverflowError, UnicodeError):
        return False

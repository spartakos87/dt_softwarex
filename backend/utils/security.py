"""JWT bearer-token verification. The signing key is never part of source code."""
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError

SECRET_KEY=os.getenv('JWT_SECRET','')
ALGORITHM='HS256'
oauth2_scheme=OAuth2PasswordBearer(tokenUrl='/api/v1/login')

def _secret() -> str:
    if len(SECRET_KEY) < 32:
        raise RuntimeError('JWT_SECRET must be supplied with at least 32 characters')
    return SECRET_KEY

def get_current_user(token: str=Depends(oauth2_scheme)) -> str:
    unauthorized=HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Invalid or expired credentials',headers={'WWW-Authenticate':'Bearer'})
    try:
        payload=jwt.decode(token,_secret(),algorithms=[ALGORITHM])
        username=payload.get('sub')
        if not isinstance(username,str) or not username:
            raise unauthorized
        return username
    except (JWTError, ExpiredSignatureError):
        raise unauthorized

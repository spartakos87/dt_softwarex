"""Authentication for the local demo; no plaintext-password acceptance."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from utils.db_utils import connect_to_db
from utils.security import ALGORITHM, _secret, get_current_user
from utils.passwords import verify_password

router=APIRouter(tags=['Authentication'])

@router.post('/login')
def login(form_data:OAuth2PasswordRequestForm=Depends()):
    conn=connect_to_db()
    if conn is None:
        raise HTTPException(status_code=503,detail='Database unavailable')
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT password FROM users WHERE username=%s',(form_data.username,))
            record=cur.fetchone()
    finally: conn.close()
    if not record or not verify_password(form_data.password,record[0]):
        raise HTTPException(status_code=401,detail='Invalid credentials')
    token=jwt.encode({'sub':form_data.username,'exp':datetime.now(timezone.utc)+timedelta(hours=1)},
                     _secret(),algorithm=ALGORITHM)
    return {'access_token':token,'token_type':'bearer'}

@router.get('/healthCheck')
def health_check(current_user:str=Depends(get_current_user)):
    return {'status':'ok','user':current_user}

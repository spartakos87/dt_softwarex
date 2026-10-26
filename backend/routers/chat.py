"""Optional explanatory assistant. The demo runs without any external AI key."""
import os
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from utils.security import get_current_user

router=APIRouter(tags=['AIAssistant'])
class MessageRequest(BaseModel):
    message:str=Field(min_length=1,max_length=2000)

@router.post('/getAIResponse')
def get_ai_response(payload:MessageRequest,current_user:str=Depends(get_current_user)):
    key=os.getenv('OPENAI_API_KEY','')
    if not key:
        raise HTTPException(status_code=503,detail='AI assistant is disabled; set OPENAI_API_KEY to enable')
    try:
        from openai import OpenAI
        client=OpenAI(api_key=key,timeout=15.0)
        answer=client.responses.create(model=os.getenv('OPENAI_MODEL','gpt-4.1-mini'),
            instructions='Answer briefly only about sensors or digital twins. Reject unrelated requests.',
            input=payload.message)
        return {'response':answer.output_text}
    except Exception:
        raise HTTPException(status_code=502,detail='AI provider unavailable')

@router.get('/aiHealthCheck')
def ai_health_check(current_user:str=Depends(get_current_user)):
    return {'enabled':bool(os.getenv('OPENAI_API_KEY'))}

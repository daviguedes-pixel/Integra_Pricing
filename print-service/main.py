import sys
import asyncio

# Configuração explícita do Event Loop Policy para Windows
# Necessário para que o Playwright funcione corretamente (suporte a subprocessos)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import base64
from screenshot import ScreenshotService
import uvicorn

app = FastAPI(
    title="Screenshot Service API",
    description="API para geração de prints de cotações com suporte a filtros, datas, autenticação dinâmica e combinação de imagens.",
    version="2.0.0"
)
service = ScreenshotService()

class ScreenshotGroup(BaseModel):
    pracas: List[str]
    combine: bool = False

class ScreenshotRequest(BaseModel):
    view_mode: str = "market" # market or company
    date: Optional[str] = None
    groups: List[ScreenshotGroup]

    class Config:
        json_schema_extra = {
            "example": {
                "view_mode": "market",
                "date": "2024-02-07",
                "groups": [
                    {"pracas": ["GO/GO"], "combine": False},
                    {"pracas": ["DF/DF"], "combine": False},
                    {"pracas": ["BA/BA", "GO/BA", "DF/BA"], "combine": True}
                ]
            }
        }

@app.on_event("startup")
async def startup():
    print(f"FastAPI starting up service... Loop: {type(asyncio.get_running_loop())}")
    await service.start()
    print("FastAPI startup finished.")

@app.on_event("shutdown")
async def shutdown():
    await service.close()

security = HTTPBearer(auto_error=False)

@app.post("/api/screenshot")
async def get_screenshots(
    request: ScreenshotRequest,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    try:
        # Extrair token do header se existir (via Depends)
        token = None
        if creds:
            token = creds.credentials
        
        # Flattened list of results
        all_results = []
        
        # Process each group
        for group in request.groups:
            images = await service.generate_screenshots(
                view_mode=request.view_mode,
                date=request.date,
                pracas=group.pracas,
                combine=group.combine,
                token=token
            )
            all_results.extend(images)
        
        # Convert bytes to base64 for JSON response
        results = []
        for img in all_results:
            results.append({
                "praca": img["name"],
                "base64": base64.b64encode(img["image_data"]).decode("utf-8")
            })
            
        return {"success": True, "screenshots": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Force 'asyncio' loop to respect the policy set at top of file
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, loop="asyncio")

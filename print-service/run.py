import sys
import asyncio
import uvicorn

# Configuração explícita do Event Loop Policy para Windows
# Isso garante que o Playwright funcione com subprocessos
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

if __name__ == "__main__":
    print("Iniciando serviço com política de Event Loop configurada para Windows.")
    # loop="asyncio" força o uvicorn a usar a política padrão do asyncio (que acabamos de configurar)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, loop="asyncio")

import asyncio
import os
from screenshot import ScreenshotService
from dotenv import load_dotenv

# Force load env to be sure
load_dotenv()

async def main():
    print("--- STARTING DIRECT TEST ---")
    
    email = os.getenv("EMAIL")
    print(f"Loaded EMAIL from env: {email}") # Don't print password
    url = os.getenv("FRONTEND_URL")
    print(f"Loaded FRONTEND_URL from env: {url}")
    
    service = ScreenshotService()
    
    print("Initializing Service (Browser Launch)...")
    await service.start()
    
    try:
        print("calling generate_screenshots...")
        # Test with a specific Praça that likely exists, or 'all'
        # 'GO/GO' was in the user's previous context, let's try that or just 'all' first for simplicity?
        # Let's try 'GO/GO' as requested before.
        pracas_to_test = ["GO/GO"] 
        
        results = await service.generate_screenshots(
            view_mode="market",
            date="2026-02-06", # Today/irrelevant if not using date picker yet
            pracas=pracas_to_test
        )
        
        print(f"Generated {len(results)} screenshots.")
        
        for i, res in enumerate(results):
            filename = f"direct_test_{i}_{res['name'].replace('/', '_')}.png"
            with open(filename, "wb") as f:
                f.write(res['image_data'])
            print(f"Saved {filename} (Size: {len(res['image_data'])} bytes)")
            
    except Exception as e:
        print(f"!!! ERROR DURING EXECUTION !!!")
        print(e)
        import traceback
        traceback.print_exc()
    finally:
        print("Closing service...")
        await service.close()
        print("--- TEST FINISHED ---")

if __name__ == "__main__":
    asyncio.run(main())

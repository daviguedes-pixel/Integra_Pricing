import sys
print("Script started", flush=True)

try:
    import playwright
    print("Playwright module found", flush=True)
    from playwright.async_api import async_playwright
    print("Async API imported", flush=True)
except Exception as e:
    print(f"Import failed: {e}", flush=True)

import asyncio

async def main():
    print("Entering main", flush=True)
    try:
        async with async_playwright() as p:
            print("Playwright context created", flush=True)
            print("Suggesting browsers...", flush=True)
            print("Launching chromium...", flush=True)
            # Add timeout to launch
            browser = await p.chromium.launch(headless=True, timeout=10000)
            print("Browser launched!", flush=True)
            await browser.close()
            print("Browser closed", flush=True)
    except Exception as e:
        print(f"Error in main: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright

async def main():
    print("Starting Playwright...")
    try:
        async with async_playwright() as p:
            print("Launching Chromium...")
            browser = await p.chromium.launch(headless=True)
            print("Launch Success!")
            await browser.close()
    except Exception as e:
        print(f"Launch Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())

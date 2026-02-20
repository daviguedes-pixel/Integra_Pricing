import os
import asyncio
from typing import List, Optional
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from dotenv import load_dotenv
import io

# Try to import Pillow, fallback if not installed
try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    print("Warning: Pillow (PIL) is not installed. Image combination will be disabled.")
    Image = None
    PILLOW_AVAILABLE = False

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
EMAIL = os.getenv("EMAIL")
PASSWORD = os.getenv("PASSWORD")
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"

class ScreenshotService:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.playwright = None

    async def start(self):
        if not self.browser:
            loop = asyncio.get_running_loop()
            print(f"Starting Playwright (Headless={HEADLESS})... Loop: {type(loop)}")
            self.playwright = await async_playwright().start()
            print("Playwright started. Launching Chromium...")
            self.browser = await self.playwright.chromium.launch(headless=HEADLESS)
            self.context = await self.browser.new_context(viewport={"width": 1920, "height": 1080})
            print("Browser launched.")

    async def ensure_login(self, page: Page, token: Optional[str] = None):
        """Ensures the user is logged in, using Token if available, else credentials."""
        
        # 1. OPTION B: Token Injection (Preferred)
        if token:
            print("Injecting Auth Token into localStorage...")
            try:
                # Construct the session object expected by Supabase
                project_ref = "ijygsxwfmribbjymxhaf"
                key = f"sb-{project_ref}-auth-token"
                
                # Create a future expiration time (1 hour from now)
                import time
                expires_at = int(time.time()) + 3600
                
                # More complete session structure
                session_data = {
                    "access_token": token,
                    "token_type": "Bearer",
                    "expires_in": 3600,
                    "expires_at": expires_at,
                    "refresh_token": token, 
                    "user": {
                        "id": "injected-user-id", 
                        "aud": "authenticated", 
                        "role": "authenticated", 
                        "email": "user@example.com",
                        "phone": "",
                        "app_metadata": {"provider": "email", "providers": ["email"]},
                        "user_metadata": {},
                        "identities": [],
                        "created_at": "2024-01-01T00:00:00.000000Z",
                        "updated_at": "2024-01-01T00:00:00.000000Z"
                    }
                }
                
                import json
                value = json.dumps(session_data)
                
                # Execute script to set storage
                await page.evaluate(f"""
                    localStorage.setItem('{key}', '{value}');
                """)
                print("Token injected. Refreshing page to apply...")
                await page.reload(wait_until="load")
                
                # Verify if we are redirected to login or stay on app
                # Wait for potential redirect
                try:
                    await page.wait_for_url(lambda url: "/login" not in url, timeout=5000)
                    print("Token injection successful. Logged in.")
                    return
                except:
                    print("Token injection failed (redirected to /login). Clearing storage and falling back...")
                    await page.evaluate("localStorage.clear()")
                    await page.reload()
            except Exception as e:
                print(f"Token injection error: {e}")

        # 2. OPTION A: Credential Login (Fallback)
        print("Fallback: Checking for login page...")
        # Give a moment for any redirects to settle
        await page.wait_for_timeout(2000)
        
        # Robust check for login page elements
        is_login_page = False
        if "/login" in page.url:
            is_login_page = True
        else:
            try:
                # Check for common login elements
                if await page.locator('input[type="email"]').count() > 0:
                    is_login_page = True
                elif await page.get_by_text("Entrar").count() > 0:
                    is_login_page = True
            except:
                pass
        
        if is_login_page:
                print(f"Login page detected. Attempting login as {EMAIL}...")
                
                try:
                    # Ensure elements are ready
                    await page.wait_for_selector('input[type="email"]', state="visible", timeout=10000)
                    
                    # Fill credentials
                    await page.fill('input[type="email"]', EMAIL)
                    await page.fill('input[type="password"]', PASSWORD)
                    
                    # Submit
                    # Try clicking the distinct submit button, or enter
                    submit_btn = page.locator('button[type="submit"]')
                    if await submit_btn.count() > 0:
                        await submit_btn.click()
                    else:
                        await page.keyboard.press("Enter")

                    # Wait for navigation away from login
                    print("Credentials submitted. Waiting for navigation...")
                    try:
                        await page.wait_for_url(lambda url: "/login" not in url, timeout=30000)
                        print("Login successful.")
                    except Exception as nav_err:
                        print(f"Timed out waiting for redirect. Accessing URL to check status... {page.url}")
                        # Take screenshot of login failure for debugging
                        await page.screenshot(path="login_failure.png")
                        raise nav_err
                        
                except Exception as e:
                    print(f"Login process failed: {e}")
                    raise Exception(f"Failed to login: {e}")
        else:
            print("Already logged in (no login page detected).")
    
    async def _hide_sidebar(self, page: Page):
        """Hides the sidebar to capture only the content."""
        # Inject CSS to hide sidebar
        await page.add_style_tag(content="""
            aside, .bg-sidebar { display: none !important; }
            header { display: none !important; } /* Optional: Hide header too if requested */
            main { margin-left: 0 !important; }
        """)

    async def _capture_single_praca(self, view_mode: str, date: str, praca_param: str) -> Optional[dict]:
        """Captures a screenshot for a single Praça or a combined list (via comma-separated param)."""
        page = await self.context.new_page()
        try:
            # Build URL with Date param and Pracas param
            url = f"{FRONTEND_URL}/quotations"
            params = []
            if date:
                params.append(f"date={date}")
            
            # If praca_param is "all", we don't add the parameter, so it fetches all.
            # If it's specific (single or comma-separated), we add it.
            if praca_param and praca_param != "all":
                params.append(f"pracas={praca_param}")
            
            if params:
                url += "?" + "&".join(params)
            
            print(f"[{praca_param}] Navigating to {url}...")
            await page.goto(url, wait_until="load", timeout=60000)
            
            # Hide Sidebar for cleaner print
            await self._hide_sidebar(page)

            # View Mode
            if view_mode == "company":
                if await page.locator("button:has-text('Visão Empresa')").get_attribute("aria-selected") != "true":
                     await page.click("button:has-text('Visão Empresa')")
            elif view_mode == "market":
                if await page.locator("button:has-text('Visão Mercado')").get_attribute("aria-selected") != "true":
                     await page.click("button:has-text('Visão Mercado')")
            
            # Wait for data/rendering
            # Since we are not interacting with filters manually, we just wait for the data to be fetched and rendered
            print(f"[{praca_param}] Waiting 30s for data/rendering...")
            await page.wait_for_timeout(30000)
            
            # Ensure we have data or "Sem dados"
            # Optional: wait for a card or loader to disappear
            
            # Capture
            if praca_param == "all":
                 filtered_praca_name = "Todas as Praças"
            else:
                 filtered_praca_name = praca_param.replace(",", "+") # meaningful name

            target_locator = page.locator("main")
            if not await target_locator.is_visible():
                target_locator = page.locator(".container").first
            
            if await target_locator.is_visible():
                buff = await target_locator.screenshot()
            else:
                buff = await page.screenshot(full_page=True)
            
            print(f"[{praca_param}] Captured.")
            
            return {"name": filtered_praca_name, "image_data": buff}

        except Exception as e:
            print(f"[{praca_param}] Error: {e}")
            return None
        finally:
            await page.close()

    # Image combination removed from here as it is now handled by the frontend view
    # But we keep the method stub or remove it if unused. 
    # The user wanted "combine" to be "select all", so backend combination is no longer needed 
    # unless they want to combine result A (Group 1) and result B (Group 2).
    # But the request implicit was about a single group.
    
    async def generate_screenshots(self, view_mode: str, date: str, pracas: List[str], combine: bool = False, token: Optional[str] = None) -> List[dict]:
        if not self.context:
            await self.start()
        
        # 1. Warm-up & Auth (Sequential)
        print("Performing initial authentication check...")
        auth_page = await self.context.new_page()
        try:
            await auth_page.goto(f"{FRONTEND_URL}/quotations", wait_until="load", timeout=30000)
            await self.ensure_login(auth_page, token)
        except Exception as e:
            print(f"Auth check failed: {e}")
            await auth_page.close()
            raise e
        finally:
            await auth_page.close()

        print("Authentication confirmed. Processing...")
        
        tasks = []
        
        # LOGIC CHANGE: 
        # If combine=True, we treat the list of pracas as a SINGLE request with multiple filters.
        # If combine=False, we treat them as individual requests.
        
        if combine and pracas:
            # Join all pracas into one comma-separated string
            combined_param = ",".join(pracas)
            print(f"Combine Mode: Requesting single view for {combined_param}")
            tasks.append(self._capture_single_praca(view_mode, date, combined_param))
        else:
            # Individual mode or "all"
            target_list = pracas if pracas else ["all"]
            for praca in target_list:
                tasks.append(self._capture_single_praca(view_mode, date, praca))
        
        results = await asyncio.gather(*tasks)
        valid_results = [r for r in results if r is not None]
        
        return valid_results

    async def close(self):
        if self.browser:
            await self.browser.close()

import requests
import base64
import json
import os

API_URL = "http://localhost:8000/api/screenshot"

def test_screenshot():
    payload = {
        "view_mode": "market",
        "date": "2026-02-05",
        "pracas": ["GO/GO"] # Test with a specific Praça
    }
    
    print(f"Sending request to {API_URL}...")
    try:
        response = requests.post(API_URL, json=payload, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            screenshots = data.get("screenshots", [])
            for i, shot in enumerate(screenshots):
                praca = shot["praca"]
                img_data = base64.b64decode(shot["base64"])
                filename = f"test_screenshot_{i}.png"
                with open(filename, "wb") as f:
                    f.write(img_data)
                print(f"Saved screenshot for {praca} to {filename} (Size: {len(img_data)} bytes)")
        else:
            print("API returned failure:", data)
            
    except Exception as e:
        print("Error during test:", e)

if __name__ == "__main__":
    test_screenshot()

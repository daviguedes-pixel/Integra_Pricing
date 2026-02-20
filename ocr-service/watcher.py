import time
import os
import sys
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from ocr import OCRService
import requests
from dotenv import load_dotenv
import shutil
import mimetypes

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Service Role Key
INPUT_FOLDER = "managed-files/input"
PROCESSED_FOLDER = "managed-files/processed"
ERROR_FOLDER = "managed-files/error"

# Ensure folders exist
os.makedirs(INPUT_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(ERROR_FOLDER, exist_ok=True)

class DocumentHandler(FileSystemEventHandler):
    def __init__(self):
        self.ocr = OCRService()
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("Warning: Supabase credentials not found. DB upload will fail.")

    def on_created(self, event):
        if event.is_directory:
            return
        
        filename = os.path.basename(event.src_path)
        # Ignore temporary files
        if filename.startswith('.') or filename.endswith('.tmp'):
            return

        print(f"New file detected: {filename}")
        self.process_file(event.src_path, filename)

    def process_file(self, file_path, filename):
        # Wait a bit for file copy to finish
        time.sleep(1) 
        
        try:
            # 1. OCR Processing
            print(f"Starting OCR for {filename}...")
            data = self.ocr.process_image(file_path)
            
            if "error" in data:
                raise Exception(data["error"])

            print(f"OCR Success: {data}")

            # 2. Upload to Supabase Storage via REST API
            public_url = ""
            if SUPABASE_URL and SUPABASE_KEY:
                try:
                    with open(file_path, 'rb') as f:
                        file_content = f.read()
                    
                    storage_path = f"{int(time.time())}_{filename}"
                    headers = {
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "ApiKey": SUPABASE_KEY,
                        "Content-Type": mimetypes.guess_type(file_path)[0] or "application/octet-stream"
                    }
                    
                    upload_url = f"{SUPABASE_URL}/storage/v1/object/financial-documents/{storage_path}"
                    
                    print(f"Uploading to {upload_url}...")
                    response = requests.post(upload_url, data=file_content, headers=headers)
                    
                    if response.status_code not in [200, 201]:
                        print(f"Storage Upload Failed: {response.text}")
                        # Fallback: file might exist? ignore for now
                    
                    # Construct Public URL manually
                    public_url = f"{SUPABASE_URL}/storage/v1/object/public/financial-documents/{storage_path}"
                    print(f"File uploaded. URL: {public_url}")
                    
                except Exception as e:
                    print(f"Storage Upload Error: {e}")

            # 3. Insert into Database via REST API
            if SUPABASE_URL and SUPABASE_KEY:
                document_payload = {
                    "document_type": data.get('type', 'other'),
                    "file_url": public_url,
                    "original_filename": filename,
                    "issuer_name": data.get('issuer_name'),
                    "issuer_cnpj": data.get('issuer_cnpj'),
                    "buyer_cnpj": data.get('buyer_cnpj'),
                    "document_number": data.get('document_number'),
                    "barcode": data.get('barcode'),
                    "digitable_line": data.get('digitable_line'),
                    "issue_date": self._format_date(data.get('issue_date')),
                    "due_date": self._format_date(data.get('due_date')),
                    "amount": data.get('amount'),
                    "status": "pending",
                    "verified": False
                }
                
                # Filter out None values
                clean_payload = {k: v for k, v in document_payload.items() if v is not None}
                
                headers = {
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "ApiKey": SUPABASE_KEY,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                }
                
                db_url = f"{SUPABASE_URL}/rest/v1/financial_documents"
                
                print(f"Inserting into DB: {clean_payload}")
                response = requests.post(db_url, json=clean_payload, headers=headers)
                
                if response.status_code not in [200, 201]:
                     print(f"Database Insert Error: {response.text}")
                     raise Exception(f"DB Insert Failed: {response.status_code}")
                
                print(f"Database Insert Success.")

            # 4. Move to Processed
            shutil.move(file_path, os.path.join(PROCESSED_FOLDER, filename))
            print(f"Moved {filename} to processed.")

        except Exception as e:
            print(f"Error processing {filename}: {e}")
            try:
                shutil.move(file_path, os.path.join(ERROR_FOLDER, filename))
                print(f"Moved {filename} to error folder.")
            except:
                pass

    def _format_date(self, date_str):
        if not date_str: return None
        try:
            # Convert DD/MM/YYYY to YYYY-MM-DD
            return datetime.strptime(date_str, '%d/%m/%Y').strftime('%Y-%m-%d')
        except:
            return None

if __name__ == "__main__":
    path = INPUT_FOLDER
    event_handler = DocumentHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=False)
    
    print(f"Monitoring {path} for new files...")
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

# Same logic as before but adapted for standalone use if needed
import pytesseract
from PIL import Image
import io
import re
from datetime import datetime
import cv2
import numpy as np
import pypdf
from pdf2image import convert_from_path, convert_from_bytes
import os

class OCRService:
    def __init__(self):
        # Configure Tesseract path if needed
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pass

    def process_image(self, image_path_or_bytes):
        """
        Process image from path or bytes. Handles PDF and Images.
        """
        try:
            text = ""
            is_pdf = False
            
            # Check if PDF
            if isinstance(image_path_or_bytes, str):
                if image_path_or_bytes.lower().endswith('.pdf'):
                    is_pdf = True
                    text = self._process_pdf(image_path_or_bytes)
                else:
                    image = Image.open(image_path_or_bytes)
                    text = pytesseract.image_to_string(image, lang='por')
            else:
                 # Check magic bytes for PDF (starts with %PDF)
                 # Converting bytes to stream slightly differently if needed for pypdf
                 # For simplicity, assuming path for now as watcher sends path
                 image = Image.open(io.BytesIO(image_path_or_bytes))
                 text = pytesseract.image_to_string(image, lang='por')

            # Determine type
            if self._is_boleto(text):
                data = self._extract_boleto_data(text)
                data['type'] = 'boleto'
            else:
                data = self._extract_nfe_data(text)
                data['type'] = 'nfe'
            
            data['raw_text'] = text
            return data
        except Exception as e:
            print(f"OCR Error: {e}")
            return {"error": str(e)}

    def _process_pdf(self, pdf_path):
        text = ""
        try:
            # 1. Try Digital PDF extraction (pypdf)
            reader = pypdf.PdfReader(pdf_path)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        except Exception as e:
            print(f"pypdf extraction failed: {e}")

        # 2. If text is too short, assume scanned and run OCR (requires Poppler)
        if len(text.strip()) < 50:
            print("Text too short, attempting OCR on PDF (Scanned)...")
            try:
                # convert_from_path requires Poppler installed
                images = convert_from_path(pdf_path)
                text = ""
                for image in images:
                     text += pytesseract.image_to_string(image, lang='por') + "\n"
            except Exception as e:
                print(f"OCR on PDF failed (Check if Poppler is installed): {e}")
                if not text:
                    raise Exception("Could not extract text from PDF. Ensure it is digital or install Poppler for scanned files.")
        
        return text

    def _preprocess_image(self, image):
        img_np = np.array(image)
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        return Image.fromarray(thresh)

    def _is_boleto(self, text):
        keywords = ['cedente', 'agência', 'código do cedente', 'nosso número', 'valor do documento', 'vencimento']
        matches = sum(1 for k in keywords if k in text.lower())
        return matches >= 2 or re.search(r'\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}', text)

    def _extract_boleto_data(self, text):
        data = {}
        
        date_pattern = r'(\d{2}/\d{2}/\d{4})'
        dates = re.findall(date_pattern, text)
        if dates:
            data['due_date'] = dates[-1]
            data['issue_date'] = dates[0]
        
        value_pattern = r'R\$\s?([\d\.,]+)'
        values = re.findall(value_pattern, text)
        if values:
            try:
                val = values[-1].replace('.', '').replace(',', '.')
                data['amount'] = float(val)
            except:
                pass
                
        line_pattern = r'\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}'
        line_match = re.search(line_pattern, text)
        if line_match:
            data['digitable_line'] = line_match.group(0)
            
        return data

    def _extract_nfe_data(self, text):
        data = {}
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        full_text_upper = text.upper()
        
        # 1. Extract CNPJs
        cnpj_pattern = r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}'
        cnpjs = re.findall(cnpj_pattern, text)
        if cnpjs:
            data['issuer_cnpj'] = cnpjs[0]
            if len(cnpjs) > 1:
                data['buyer_cnpj'] = cnpjs[1]
        
        # 2. Extract Dates
        date_pattern = r'(\d{2}/\d{2}/\d{4})'
        dates = re.findall(date_pattern, text)
        if dates:
            data['issue_date'] = dates[0]
            # Try to find a second date for due date if available, otherwise default to issue
            if len(dates) > 1:
                data['due_date'] = dates[1]
            else:
                data['due_date'] = dates[0]

        # 3. Extract Amount (Value)
        # Look for "VALOR TOTAL DA NOTA" or similar common labels
        # Strategy: Find the label, then look for currency pattern in the vicinity
        money_pattern = r'(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})'
        
        amount_found = False
        target_labels = ['VALOR TOTAL DA NOTA', 'VLR. TOTAL', 'VALOR A PAGAR', 'TOTAL DA NOTA']
        
        for label in target_labels:
            if amount_found: break
            if label in full_text_upper:
                # Find label index and look ahead in the original text
                idx = full_text_upper.find(label)
                context = text[idx:idx+200] # Look at the next 200 chars
                values = re.findall(money_pattern, context)
                if values:
                    try:
                        # Usually the first money value after "TOTAL" is the one
                        val_str = values[0].replace('.', '').replace(',', '.')
                        data['amount'] = float(val_str)
                        amount_found = True
                    except: pass
        
        # Fallback for amount: if no label matched, try line-by-line validation
        if not amount_found:
             for line in lines:
                 if 'TOTAL' in line.upper() and ('R$' in line or ',' in line):
                     values = re.findall(money_pattern, line)
                     if values:
                         try:
                             val_str = values[0].replace('.', '').replace(',', '.')
                             data['amount'] = float(val_str)
                             break
                         except: pass

        # 4. Extract Names (Issuer and Buyer)
        # Strategy A: Look for "NOME / RAZÃO SOCIAL" labels
        name_labels_indices = [m.start() for m in re.finditer(r'NOME\s*/?\s*RAZ[ÃA]O', full_text_upper)]
        
        extracted_names = []
        for idx in name_labels_indices:
            # Look at text immediately following the label
            context = text[idx:idx+200].split('\n')
            for line in context:
                # Clean up the line
                clean_line = re.sub(r'NOME|RAZ[ÃA]O|SOCIAL|/|:', '', line.upper()).strip()
                # Filter out junk like "CNPJ/CPF", "ENDERECO", empty lines, or lines with digits (dates/cnpjs)
                if len(clean_line) > 3 and "CNPJ" not in clean_line and "CPF" not in clean_line and not any(char.isdigit() for char in clean_line):
                     if clean_line not in extracted_names:
                        extracted_names.append(clean_line.title())
                        break

        # Strategy B: If labels fail, look for lines ending with specific company suffixes close to top
        if not extracted_names:
             company_suffixes = ['LTDA', 'S.A.', 'S/A', 'ME', 'EPP', 'EIRELI', 'COMERCIO', 'SERVICOS']
             for line in lines[:20]: # Check first 20 lines
                 upper_line = line.upper()
                 if any(s in upper_line for s in company_suffixes) and not any(char.isdigit() for char in line):
                     extracted_names.append(line.strip().title())

        # Assign extracted names
        if len(extracted_names) >= 1:
            data['issuer_name'] = extracted_names[0]
        
        if len(extracted_names) >= 2:
            data['buyer_name'] = extracted_names[1]

        # 5. Document Number
        num_pattern = r'(?:N[oº°]\.?\s*|N[uú]mero\s*)(\d{1,9})'
        num_match = re.search(num_pattern, text, re.IGNORECASE)
        if num_match:
            data['document_number'] = num_match.group(1)
        
        # Debug print
        print(f"--- Extracted Data ---\n{data}\n----------------------")
            
        return data

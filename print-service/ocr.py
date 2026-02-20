import pytesseract
from PIL import Image
import io
import re
from datetime import datetime
import cv2
import numpy as np

class OCRService:
    def __init__(self):
        # Ensure Tesseract is in PATH or configure it here
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pass

    def process_image(self, file_bytes: bytes):
        """
        Process uploaded image bytes and extract text/data.
        """
        try:
            image = Image.open(io.BytesIO(file_bytes))
            
            # Preprocessing (optional, can improve accuracy)
            # image = self._preprocess_image(image)
            
            text = pytesseract.image_to_string(image, lang='por') # Portuguese model
            
            # Determine type and extract data
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

    def _preprocess_image(self, image):
        # Convert to CV2 format
        img_np = np.array(image)
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        # Thresholding
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        return Image.fromarray(thresh)

    def _is_boleto(self, text):
        # Check for keywords common in Boletos
        keywords = ['cedente', 'agência', 'código do cedente', 'nosso número', 'valor do documento', 'vencimento']
        matches = sum(1 for k in keywords if k in text.lower())
        return matches >= 2 or re.search(r'\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}', text)

    def _extract_boleto_data(self, text):
        data = {}
        
        # Try to find date
        # Date format DD/MM/YYYY
        date_pattern = r'(\d{2}/\d{2}/\d{4})'
        dates = re.findall(date_pattern, text)
        if dates:
            # Usually the last date is the due date in Boletos, but this is heuristic
            data['due_date'] = dates[-1]
            data['issue_date'] = dates[0]
        
        # Try to find value
        # Look for "Valor do Documento" followed by number
        # Or Just currency format R$ X.XXX,XX
        value_pattern = r'R\$\s?([\d\.,]+)'
        values = re.findall(value_pattern, text)
        if values:
            # Clean up value
            try:
                val = values[-1].replace('.', '').replace(',', '.')
                data['amount'] = float(val)
            except:
                pass
                
        # Digitable line (Linha digitavel)
        # 47 chars roughly: 21290.00119 21100.012109 04475.617405 9 75870000055000
        line_pattern = r'\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}'
        line_match = re.search(line_pattern, text)
        if line_match:
            data['digitable_line'] = line_match.group(0)
            
        return data

    def _extract_nfe_data(self, text):
        data = {}
        
        # CNPJ extraction
        cnpj_pattern = r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}'
        cnpjs = re.findall(cnpj_pattern, text)
        if cnpjs:
            data['issuer_cnpj'] = cnpjs[0] # Usually first CNPJ matches issuer
            if len(cnpjs) > 1:
                data['buyer_cnpj'] = cnpjs[1]
        
        # Date extraction
        date_pattern = r'(\d{2}/\d{2}/\d{4})'
        dates = re.findall(date_pattern, text)
        if dates:
            data['issue_date'] = dates[0]
            
        # Total Value
        # Look for "VALOR TOTAL" or "V. TOTAL"
        # This is tricky without layout analysis, but we can try heuristic
        # Find largest monetary value usually? Or adjacent to "Total"
        
        # Simple heuristic: look for lines with "Total" and extract number
        lines = text.split('\n')
        for line in lines:
            if 'total' in line.lower() or 'pagar' in line.lower():
                # Extract value from this line
                val_match = re.search(r'[\d\.,]+', line)
                if val_match:
                     # Check if it looks like currency (has comma/dot)
                     val_str = val_match.group(0)
                     if ',' in val_str or '.' in val_str:
                         try:
                            clean_val = val_str.replace('.', '').replace(',', '.')
                            # Verify if it's a number
                            if clean_val.count('.') <= 1:
                                data['amount'] = float(clean_val)
                                break # Stop at first total found
                         except:
                             pass
        
        # NF Number
        # "No." "Número" matches
        num_pattern = r'(?:N[oº°]\.?|N[uú]mero)\s*[:.]?\s*(\d{1,9})'
        num_match = re.search(num_pattern, text, re.IGNORECASE)
        if num_match:
            data['document_number'] = num_match.group(1)
            
        return data

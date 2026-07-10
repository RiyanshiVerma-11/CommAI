import os
from dotenv import load_dotenv, find_dotenv

# Load .env file searching upwards
load_dotenv(find_dotenv())


class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "72210fafca4045a19f2a95b15deb9108comm-ai-secret-key-super-secure")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    # Resolve database path relative to the backend app root folder
    _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _default_db = f"sqlite:///{os.path.join(_base_dir, 'comm_platform.db')}"
    DATABASE_URL: str = os.getenv("DATABASE_URL", _default_db)
    
    # Pre-seeded Operator Credentials
    ADMIN_EMAIL: str = "admin@comm.ai"
    ADMIN_PASSWORD: str = "AdminPassword123!"
    
    MANAGER_EMAIL: str = "manager@comm.ai"
    MANAGER_PASSWORD: str = "ManagerPassword123!"
    
    COMMUNICATOR_EMAIL: str = "communicator@comm.ai"
    COMMUNICATOR_PASSWORD: str = "CommPassword123!"

    # --- SMTP Email Configuration (Gmail) ---
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_EMAIL: str = os.getenv("SMTP_EMAIL", "")
    SMTP_APP_PASSWORD: str = os.getenv("SMTP_APP_PASSWORD", "")

    # --- WhatsApp Configuration (CallMeBot) ---
    CALLMEBOT_DEFAULT_APIKEY: str = os.getenv("CALLMEBOT_DEFAULT_APIKEY", "")

    # --- Groq Translation Configuration ---
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # --- Country Code for Phone Numbers ---
    DEFAULT_COUNTRY_CODE: str = os.getenv("DEFAULT_COUNTRY_CODE", "91")  # India

    # --- Daily Send Caps Guardrails ---
    DAILY_CAP_EMAIL: int = 5000
    DAILY_CAP_SMS: int = 5000
    DAILY_CAP_WHATSAPP: int = 5000

    # Supported System Constants
    ROLES = ["admin", "campaign_manager", "communicator"]
    
    LANGUAGES = [
        "English", "Hindi", "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", 
        "Kannada", "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri", 
        "Marathi", "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi", 
        "Tamil", "Telugu", "Urdu"
    ]
    
    OCCUPATIONS = [
        "Farmer", "Student", "Teacher", "Healthcare Worker", 
        "NGO Worker", "Administrator", "General Public", "Business Owner"
    ]
    
    CATEGORIES = ["emergency", "awareness", "education", "announcement"]
    
    CHANNELS = ["email", "sms", "whatsapp", "push", "website"]

    def load_overrides(self):
        import json
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "settings.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    data = json.load(f)
                self.SMTP_HOST = data.get("SMTP_HOST", self.SMTP_HOST)
                self.SMTP_PORT = int(data.get("SMTP_PORT", self.SMTP_PORT))
                self.SMTP_EMAIL = data.get("SMTP_EMAIL", self.SMTP_EMAIL)
                self.SMTP_APP_PASSWORD = data.get("SMTP_APP_PASSWORD", self.SMTP_APP_PASSWORD)
                self.CALLMEBOT_DEFAULT_APIKEY = data.get("CALLMEBOT_DEFAULT_APIKEY", self.CALLMEBOT_DEFAULT_APIKEY)
                self.GROQ_API_KEY = data.get("GROQ_API_KEY", self.GROQ_API_KEY)
                self.DEFAULT_COUNTRY_CODE = data.get("DEFAULT_COUNTRY_CODE", self.DEFAULT_COUNTRY_CODE)
                self.DAILY_CAP_EMAIL = int(data.get("DAILY_CAP_EMAIL", self.DAILY_CAP_EMAIL))
                self.DAILY_CAP_SMS = int(data.get("DAILY_CAP_SMS", self.DAILY_CAP_SMS))
                self.DAILY_CAP_WHATSAPP = int(data.get("DAILY_CAP_WHATSAPP", self.DAILY_CAP_WHATSAPP))
            except Exception as e:
                print(f"[CONFIG] Error loading settings overrides: {e}")

    def save_overrides(self, data: dict):
        import json
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "settings.json")
        try:
            # Merge with existing file if it exists
            existing = {}
            if os.path.exists(config_path):
                with open(config_path, "r") as f:
                    existing = json.load(f)
            
            existing.update(data)
            
            with open(config_path, "w") as f:
                json.dump(existing, f, indent=4)
            
            # Reload settings
            self.load_overrides()
            return True
        except Exception as e:
            print(f"[CONFIG] Error saving settings overrides: {e}")
            return False

settings = Settings()
settings.load_overrides()



import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
KITCHEN_GROUP_ID = int(os.getenv("KITCHEN_GROUP_ID", "0"))
# Single deployment = one restaurant tenant (set RESTAURANT_ID per instance).
DEFAULT_RESTAURANT_ID = int(os.getenv("RESTAURANT_ID", "1"))
BOT_RESTAURANT_ID = DEFAULT_RESTAURANT_ID
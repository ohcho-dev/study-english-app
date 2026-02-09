import sys
import asyncio
from pathlib import Path

# Add project root to path
# We are in apps/server/scripts, so parent is apps/server
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.conversation import ConversationTemplate

async def check_templates():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ConversationTemplate))
        templates = result.scalars().all()
        
        print(f"Found {len(templates)} templates")
        for t in templates:
            print(f"--- Template: {t.name} ---")
            print(f"Greeting: {t.greeting_message}")
            print(f"Scene Context: {t.scene_context}")
            print(f"System Prompt: {t.system_prompt}")
            print("---------------------------")

if __name__ == "__main__":
    asyncio.run(check_templates())

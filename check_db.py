import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/studyenglish")
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, name, director_llm_model FROM conversation_templates ORDER BY created_at DESC LIMIT 3;"))
        for row in result:
            print(f"ID: {row[0]}, Name: {row[1]}, Model: {row[2]}")
    await engine.dispose()

asyncio.run(main())

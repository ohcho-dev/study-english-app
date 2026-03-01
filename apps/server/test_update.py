import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.conversation import ConversationTemplate

async def main():
    try:
        engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/studyenglish", echo=False)
        async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        
        async with async_session() as session:
            query = select(ConversationTemplate).limit(1)
            result = await session.execute(query)
            template = result.scalar_one_or_none()
            
            if template:
                print("Before Update DB model:", template.director_llm_model)
                template.director_llm_model = "test-model-isolated"
                await session.commit()
                print("Successfully committed!")
                print("After Update DB model:", template.director_llm_model)
            else:
                print("No template found.")
        
        await engine.dispose()
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())

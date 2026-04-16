from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
db.execute(text("UPDATE alembic_version SET version_num = 's4t5u6v7w8x9';"))
db.commit()
print("Updated successfully")

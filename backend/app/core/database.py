from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

class Base(DeclarativeBase):
    pass

class DatabaseManager:
    def __init__(self, db_url: str):
        self.engine = create_async_engine(
            db_url,
            echo=False,
            pool_pre_ping=True
        )
        # Az aszinkron session gyár (sessionmaker)
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False
        )

    async def get_db_session(self) -> AsyncGenerator[AsyncSession, None]:
        async with self.session_factory() as session:
            try:
                yield session
            finally:
                await session.close()

db_manager = DatabaseManager(settings.ASYNC_DATABASE_URL)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in db_manager.get_db_session():
        yield session
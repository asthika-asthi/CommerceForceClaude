from typing import Generic, List, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int


def paginate(items: List[T], total: int, page: int, page_size: int) -> Page[T]:
    pages = max(1, (total + page_size - 1) // page_size)
    return Page(items=items, total=total, page=page, page_size=page_size, pages=pages)

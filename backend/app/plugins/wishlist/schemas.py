from pydantic import BaseModel


class WishlistItemOut(BaseModel):
    id: str
    user_id: str
    product_id: str

    model_config = {"from_attributes": True}

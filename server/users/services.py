from products.models import Shop
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from .roles import is_admin_user

ADMIN_DEFAULT_SHOP_NAME = "Flypick"
ADMIN_DEFAULT_SHOP_CATEGORY = "Marketplace"
ADMIN_DEFAULT_SHOP_DESCRIPTION = "Main Flypick admin storefront."


def ensure_admin_shop(user):
    if not is_admin_user(user):
        return None

    shop = (
        Shop.objects.filter(seller=user)
        .order_by("id")
        .first()
    )
    if shop:
        return shop

    return Shop.objects.create(
        seller=user,
        name=ADMIN_DEFAULT_SHOP_NAME,
        category=ADMIN_DEFAULT_SHOP_CATEGORY,
        description=ADMIN_DEFAULT_SHOP_DESCRIPTION,
        status="active",
    )


def assert_user_can_authenticate(user):
    if user.role == "Seller":
        profile = getattr(user, "seller_profile", None)
        if not profile:
            raise AuthenticationFailed("Seller profile not found.")

        if profile.status == "pending":
            raise AuthenticationFailed("Your seller request is pending admin approval.")
        if profile.status == "rejected":
            raise AuthenticationFailed("Your seller request was rejected by admin.")
        if profile.status == "suspended":
            raise AuthenticationFailed("Your seller account is suspended.")
        if profile.status != "active":
            raise AuthenticationFailed("Your seller account is not active.")

    if is_admin_user(user):
        ensure_admin_shop(user)

    return user


def issue_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
    }

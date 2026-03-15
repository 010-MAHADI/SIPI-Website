from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.routers import DefaultRouter
from .social_auth import (
    AppleOAuthCallbackView,
    AppleOAuthStartView,
    GoogleOAuthCallbackView,
    GoogleOAuthStartView,
)
from .views import (
    AddressViewSet,
    CustomerProfileView,
    CustomerRegisterView,
    CustomTokenObtainPairView,
    ProfileView,
    RegisterView,
    SellerRequestListAPIView,
    SellerRequestReviewAPIView,
    SellerViewSet,
)
from .views_dashboard import DashboardStatsAPIView

router = DefaultRouter()
router.register(r'list', SellerViewSet, basename='seller')

# Separate router for addresses to make them accessible at /api/auth/addresses/
address_router = DefaultRouter()
address_router.register(r'addresses', AddressViewSet, basename='address')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('customer/register/', CustomerRegisterView.as_view(), name='customer-register'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('social/google/start/', GoogleOAuthStartView.as_view(), name='social-google-start'),
    path('social/google/callback/', GoogleOAuthCallbackView.as_view(), name='social-google-callback'),
    path('social/apple/start/', AppleOAuthStartView.as_view(), name='social-apple-start'),
    path('social/apple/callback/', AppleOAuthCallbackView.as_view(), name='social-apple-callback'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('customer/profile/', CustomerProfileView.as_view(), name='customer-profile'),
    path('dashboard/stats/', DashboardStatsAPIView.as_view(), name='dashboard_stats'),
    path('seller-requests/', SellerRequestListAPIView.as_view(), name='seller-requests-list'),
    path('seller-requests/<int:seller_id>/review/', SellerRequestReviewAPIView.as_view(), name='seller-requests-review'),
    path('sellers/', include(router.urls)),
    path('', include(address_router.urls)),  # Addresses at /api/auth/addresses/
]

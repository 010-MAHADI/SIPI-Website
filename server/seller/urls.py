from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnalyticsAPIView,
    CategoryViewSet,
    CouponViewSet,
    CustomersAPIView,
    CustomerDetailAPIView,
    PaymentMethodSettingsAPIView,
    ReviewViewSet,
    TransactionsAPIView,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="seller-categories")
router.register(r"reviews", ReviewViewSet, basename="seller-reviews")
router.register(r"coupons", CouponViewSet, basename="seller-coupons")

urlpatterns = [
    path("", include(router.urls)),
    path("customers/", CustomersAPIView.as_view(), name="seller-customers"),
    path("customers/<int:customer_id>/", CustomerDetailAPIView.as_view(), name="seller-customer-detail"),
    path("analytics/", AnalyticsAPIView.as_view(), name="seller-analytics"),
    path("transactions/", TransactionsAPIView.as_view(), name="seller-transactions"),
    path(
        "transactions/payment-methods/",
        PaymentMethodSettingsAPIView.as_view(),
        name="seller-payment-methods",
    ),
]


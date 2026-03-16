from django.contrib import admin

from .models import Category, Coupon, CouponProduct, PaymentMethodSetting


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "seller", "status", "updated_at")
    search_fields = ("name", "seller__email", "seller__username")
    list_filter = ("status",)


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "seller", "coupon_type", "discount_type", "discount_value", "uses", "max_uses", "is_active")
    search_fields = ("code", "seller__email", "seller__username")
    list_filter = ("coupon_type", "discount_type", "is_active")


@admin.register(CouponProduct)
class CouponProductAdmin(admin.ModelAdmin):
    list_display = ("coupon", "product", "created_at")
    search_fields = ("coupon__code", "product__title")


@admin.register(PaymentMethodSetting)
class PaymentMethodSettingAdmin(admin.ModelAdmin):
    list_display = ("seller", "cash_on_delivery", "bkash", "nagad", "credit_card", "updated_at")
    search_fields = ("seller__email", "seller__username")


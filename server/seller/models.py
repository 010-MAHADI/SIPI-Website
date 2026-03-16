from django.conf import settings
from django.db import models
from django.utils.text import slugify

from products.models import Product


class Category(models.Model):
    STATUS_CHOICES = (
        ("active", "Active"),
        ("inactive", "Inactive"),
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seller_categories"
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)
    description = models.TextField(blank=True, default="")
    image_url = models.URLField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("seller", "slug")

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:140]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.seller_id})"


class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = (
        ("percent", "Percent"),
        ("fixed", "Fixed"),
        ("shipping", "Free Shipping"),
    )
    
    COUPON_TYPE_CHOICES = (
        ("all_products", "All Products"),
        ("specific_products", "Specific Products"),
        ("category", "Category"),
        ("first_order", "First Order Only"),
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seller_coupons"
    )
    code = models.CharField(max_length=40)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default="percent")
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    coupon_type = models.CharField(max_length=20, choices=COUPON_TYPE_CHOICES, default="all_products")
    category = models.ForeignKey(
        'products.Category', on_delete=models.CASCADE, null=True, blank=True, 
        help_text="Required when coupon_type is 'category'"
    )
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Minimum order amount to apply coupon")
    uses = models.PositiveIntegerField(default=0)
    max_uses = models.PositiveIntegerField(default=100)
    expires_at = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("seller", "code")

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code


class CouponProduct(models.Model):
    """Many-to-many relationship between coupons and specific products"""
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="coupon_products")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("coupon", "product")

    def __str__(self):
        return f"{self.coupon.code} - {self.product.title}"


class PaymentMethodSetting(models.Model):
    seller = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payment_method_setting"
    )
    cash_on_delivery = models.BooleanField(default=True)
    bkash = models.BooleanField(default=True)
    nagad = models.BooleanField(default=True)
    credit_card = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment Methods ({self.seller_id})"


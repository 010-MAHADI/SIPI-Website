from django.db import models
from django.conf import settings
from products.models import Product, Shop

class PaymentMethod(models.Model):
    """Global payment method configuration"""
    shop = models.OneToOneField(Shop, on_delete=models.CASCADE, related_name='payment_methods', null=True, blank=True)
    # If shop is null, these are global/default settings
    
    cash_on_delivery = models.BooleanField(default=True)
    bkash = models.BooleanField(default=True)
    nagad = models.BooleanField(default=True)
    credit_card = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Payment Method Configuration'
        verbose_name_plural = 'Payment Method Configurations'
    
    def __str__(self):
        if self.shop:
            return f"Payment Methods for {self.shop.name}"
        return "Global Payment Methods"


class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    )
    
    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )
    
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    order_id = models.CharField(max_length=50, unique=True, db_index=True)
    
    # Address information
    shipping_full_name = models.CharField(max_length=200, blank=True, null=True)
    shipping_phone = models.CharField(max_length=20, blank=True, null=True)
    shipping_street = models.TextField(blank=True, null=True)
    shipping_city = models.CharField(max_length=100, blank=True, null=True)
    shipping_state = models.CharField(max_length=100, blank=True, null=True)
    shipping_zip_code = models.CharField(max_length=20, blank=True, null=True)
    shipping_country = models.CharField(max_length=100, default='Bangladesh')
    
    # Payment information
    payment_method = models.CharField(max_length=50, default='cod')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    
    # Pricing
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    coupon_code = models.CharField(max_length=50, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Store original status for change detection
        self._original_status = self.status
    
    def save(self, *args, **kwargs):
        # Update original status after save
        super().save(*args, **kwargs)
        self._original_status = self.status
    
    def __str__(self):
        return f"Order {self.order_id} by {self.customer.username}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, related_name='order_items')
    
    # Product snapshot (in case product is deleted/changed)
    product_title = models.CharField(max_length=500)
    product_image = models.TextField(blank=True, null=True)
    
    # Variant information
    color = models.CharField(max_length=50, blank=True, null=True)
    size = models.CharField(max_length=50, blank=True, null=True)
    shipping_type = models.CharField(max_length=100, blank=True, null=True)
    
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    def __str__(self):
        return f"{self.quantity} x {self.product_title}"
    
    @property
    def total_price(self):
        return self.price * self.quantity


class ReturnRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('refunded', 'Refunded'),
    )
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='return_requests')
    return_id = models.CharField(max_length=50, unique=True, db_index=True)
    
    reason = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    admin_note = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Return {self.return_id} for Order {self.order.order_id}"


class ReturnItem(models.Model):
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, related_name='items')
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE)
    
    quantity = models.PositiveIntegerField(default=1)
    reason = models.CharField(max_length=200, blank=True, null=True)
    
    def __str__(self):
        return f"{self.quantity} x {self.order_item.product_title}"

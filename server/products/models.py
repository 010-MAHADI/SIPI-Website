from django.db import models
from django.conf import settings
from utils.file_upload import product_image_path, product_video_path

class Category(models.Model):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['sort_order', 'name']
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

class Shop(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    )
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shops')
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=255)  # Will be changed to ForeignKey later
    category_fk = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='shops_new')
    description = models.TextField(blank=True, null=True)
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    sender_mobile_no = models.CharField(max_length=20, blank=True, null=True)
    sender_village = models.CharField(max_length=255, blank=True, null=True)
    sender_post_office = models.CharField(max_length=255, blank=True, null=True)
    sender_post_code = models.CharField(max_length=20, blank=True, null=True)
    sender_upazila = models.CharField(max_length=255, blank=True, null=True)
    sender_zilla = models.CharField(max_length=255, blank=True, null=True)
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    commission = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    createdDate = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='products')
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=255, blank=True, null=True)  # Will be changed to ForeignKey later
    category_fk = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products_new')
    sku = models.CharField(max_length=100, blank=True, null=True)
    brand = models.CharField(max_length=255, blank=True, null=True)
    barcode = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    short_description = models.CharField(max_length=500, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    originalPrice = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    actualCost = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)  # Add actualCost field
    discount = models.IntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0.0)
    reviews_count = models.IntegerField(default=0)
    sold_count = models.IntegerField(default=0)
    stock = models.IntegerField(default=0)
    image = models.ImageField(upload_to=product_image_path, blank=True, null=True)
    video = models.FileField(upload_to=product_video_path, blank=True, null=True)
    badges = models.JSONField(blank=True, null=True, default=list) # E.g., ["Choice", "Sale"]
    variants = models.JSONField(blank=True, null=True, default=dict) # Store variant data: colors, sizes, etc.
    freeShipping = models.BooleanField(default=False)
    welcomeDeal = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default='Draft')
    is_featured = models.BooleanField(default=False)
    weight = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    weight_unit = models.CharField(max_length=10, default='kg')
    meta_title = models.CharField(max_length=255, blank=True, null=True)
    meta_description = models.TextField(blank=True, null=True)
    return_policy = models.CharField(max_length=100, blank=True, null=True)
    warranty = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.title
    
    @property
    def image_url(self):
        """Return full URL for the image"""
        if self.image:
            return self.image.url
        return None

    @property
    def video_url(self):
        """Return full URL for the video"""
        if self.video:
            return self.video.url
        return None
    
    def save(self, *args, **kwargs):
        # Auto-generate SKU if not provided
        if not self.sku:
            # Will be set after save when we have an ID
            super().save(*args, **kwargs)
            if not self.sku:
                self.sku = f"PRD-{self.id:05d}"
                super().save(update_fields=['sku'])
        else:
            super().save(*args, **kwargs)


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='gallery_images')
    image = models.ImageField(upload_to=product_image_path)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']


class ProductVideo(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='gallery_videos')
    video = models.FileField(upload_to=product_video_path)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']

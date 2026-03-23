from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('Customer', 'Customer'),
        ('Seller', 'Seller'),
        ('Admin', 'Admin'),
    )
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Customer')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

class SellerProfile(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('pending', 'Pending'),
        ('suspended', 'Suspended'),
        ('rejected', 'Rejected'),
    )
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='seller_profile')
    phone = models.CharField(max_length=20, blank=True, null=True)
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    mobile_no = models.CharField(max_length=20, blank=True, null=True)
    village = models.CharField(max_length=255, blank=True, null=True)
    post_office = models.CharField(max_length=255, blank=True, null=True)
    post_code = models.CharField(max_length=20, blank=True, null=True)
    upazila = models.CharField(max_length=255, blank=True, null=True)
    zilla = models.CharField(max_length=255, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    business_name = models.CharField(max_length=255, blank=True, null=True)
    business_category = models.CharField(max_length=255, blank=True, null=True)
    business_description = models.TextField(blank=True, null=True)
    additional_info = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    idDocument = models.CharField(max_length=255, blank=True, null=True)
    bankAccount = models.CharField(max_length=255, blank=True, null=True)
    verified = models.BooleanField(default=False)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='reviewed_seller_profiles',
    )
    review_note = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}'s Seller Profile"

class CustomerProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='customer_profile')
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_photo = models.TextField(blank=True, null=True)  # Store base64 or URL
    email_notifications = models.BooleanField(default=True)
    language = models.CharField(max_length=10, default='en')
    currency = models.CharField(max_length=10, default='BDT')
    admin_note = models.TextField(blank=True, null=True)
    last_login_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email}'s Customer Profile"


class Address(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='addresses')
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    street = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True, null=True)
    zip_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, default='Bangladesh')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Addresses'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.full_name} - {self.city}"

    def save(self, *args, **kwargs):
        # If this is set as default, unset all other defaults for this user
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)

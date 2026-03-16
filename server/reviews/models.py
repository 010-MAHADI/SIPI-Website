from django.db import models
from django.conf import settings
from products.models import Product

class Review(models.Model):
    STATUS_CHOICES = (
        ("published", "Published"),
        ("pending", "Pending"),
        ("rejected", "Rejected"),
    )
    
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    text = models.TextField()
    
    helpful = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="published")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['product', 'user']
    
    def __str__(self):
        return f"Review by {self.user.username} for {self.product.title}"


class ReviewImage(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='reviews/')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Image for review {self.review.id}"

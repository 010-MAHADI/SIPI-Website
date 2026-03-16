from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from django.db.models import Avg
from .models import Review
from .serializers import ReviewSerializer, ReviewCreateSerializer

class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        product_id = self.kwargs.get('product_pk')
        if product_id:
            # For public product pages, only show published reviews
            return Review.objects.filter(product_id=product_id, status='published')
        return Review.objects.filter(status='published')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ReviewCreateSerializer
        return ReviewSerializer
    
    def create(self, request, *args, **kwargs):
        product_id = self.kwargs.get('product_pk')
        
        # Check if user already reviewed this product
        if Review.objects.filter(product_id=product_id, user=request.user).exists():
            return Response(
                {'detail': 'You have already reviewed this product.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Reviews are published by default for now, can be changed to 'pending' if moderation is needed
        serializer.save(user=request.user, product_id=product_id, status='published')
        
        # Update product rating and reviews_count
        from products.models import Product
        product = Product.objects.get(id=product_id)
        reviews = Review.objects.filter(product=product, status='published')
        product.reviews_count = reviews.count()
        product.rating = reviews.aggregate(Avg('rating'))['rating__avg'] or 0
        product.save()
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Calculate average rating
        avg_rating = queryset.aggregate(Avg('rating'))['rating__avg'] or 0
        
        return Response({
            'results': serializer.data,
            'count': queryset.count(),
            'average_rating': round(avg_rating, 1)
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def helpful(self, request, pk=None, product_pk=None):
        review = self.get_object()
        review.helpful += 1
        review.save()
        return Response({'helpful': review.helpful})

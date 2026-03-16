from rest_framework import serializers
from .models import Review, ReviewImage

class ReviewImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    
    class Meta:
        model = ReviewImage
        fields = ['id', 'image']
    
    def get_image(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    images = ReviewImageSerializer(many=True, read_only=True)
    date = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Review
        fields = ['id', 'user', 'user_name', 'rating', 'text', 'helpful', 'images', 'date', 'status', 'created_at']
        read_only_fields = ['user', 'helpful', 'created_at']


class ReviewCreateSerializer(serializers.ModelSerializer):
    images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Review
        fields = ['rating', 'text', 'images']
    
    def create(self, validated_data):
        images_data = validated_data.pop('images', [])
        review = Review.objects.create(**validated_data)
        
        for image_data in images_data:
            ReviewImage.objects.create(review=review, image=image_data)
        
        return review

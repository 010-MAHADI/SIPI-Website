from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from products.serializers import ShopSerializer

from .models import SellerProfile
from .roles import is_admin_user
from .services import ensure_admin_shop

User = get_user_model()


class SellerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerProfile
        fields = [
            "phone",
            "avatar",
            "location",
            "address",
            "business_name",
            "business_category",
            "business_description",
            "additional_info",
            "status",
            "idDocument",
            "bankAccount",
            "verified",
            "reviewed_at",
            "review_note",
        ]


class SellerSerializer(serializers.ModelSerializer):
    seller_profile = SellerProfileSerializer()
    shops = ShopSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined", "seller_profile", "shops"]


class UserSerializer(serializers.ModelSerializer):
    seller_profile = SellerProfileSerializer(read_only=True)
    shop_count = serializers.SerializerMethodField()
    max_shops = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "is_superuser",
            "seller_profile",
            "shop_count",
            "max_shops",
        ]

    def get_shop_count(self, obj):
        return obj.shops.count()

    def get_max_shops(self, obj):
        return 5 if obj.role == "Seller" else None


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import CustomerProfile
        model = CustomerProfile
        fields = [
            'first_name',
            'last_name',
            'phone',
            'profile_photo',
            'email_notifications',
            'language',
            'currency',
        ]


class CustomerRegisterSerializer(serializers.ModelSerializer):
    """Serializer for customer registration"""
    password = serializers.CharField(write_only=True, min_length=8)
    username = serializers.CharField(required=False, allow_blank=True)
    customer_profile = CustomerProfileSerializer(required=False)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "customer_profile",
        ]

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        customer_profile_data = validated_data.pop('customer_profile', {})
        username = validated_data.pop('username', '').strip()
        email = validated_data['email']
        
        # Generate username from email if not provided
        if not username:
            username = email.split('@')[0]
            # Ensure username is unique
            counter = 1
            original_username = username
            while User.objects.filter(username=username).exists():
                username = f"{original_username}{counter}"
                counter += 1

        # Create user with Customer role
        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data['password'],
            role='Customer',
        )

        # Create customer profile if data provided
        if customer_profile_data:
            from .models import CustomerProfile
            CustomerProfile.objects.create(user=user, **customer_profile_data)

        return user


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    username = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False, default="Seller")
    owner_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    business_name = serializers.CharField(required=False, allow_blank=True)
    business_category = serializers.CharField(required=False, allow_blank=True)
    business_description = serializers.CharField(required=False, allow_blank=True)
    additional_info = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "role",
            "owner_name",
            "phone",
            "address",
            "business_name",
            "business_category",
            "business_description",
            "additional_info",
        ]

    def validate(self, attrs):
        role = attrs.get("role", "Seller")
        if role == "Admin":
            raise serializers.ValidationError({"role": "Admin accounts cannot be self-registered."})

        if role == "Seller":
            required = {
                "owner_name": "Owner name is required.",
                "phone": "Phone number is required.",
                "address": "Address is required.",
                "business_name": "Business name is required.",
                "business_category": "Business category is required.",
                "business_description": "Business description is required.",
            }
            errors = {}
            for key, message in required.items():
                if not str(attrs.get(key, "")).strip():
                    errors[key] = message
            if errors:
                raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        role = validated_data.pop("role", "Seller")
        owner_name = validated_data.pop("owner_name", "").strip()
        phone = validated_data.pop("phone", "").strip()
        address = validated_data.pop("address", "").strip()
        business_name = validated_data.pop("business_name", "").strip()
        business_category = validated_data.pop("business_category", "").strip()
        business_description = validated_data.pop("business_description", "").strip()
        additional_info = validated_data.pop("additional_info", "").strip()

        username = validated_data.pop("username", "").strip()
        email = validated_data["email"]
        if not username:
            if owner_name:
                username = owner_name
            else:
                username = email.split("@")[0]

        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data["password"],
            role=role,
        )

        if user.role == "Seller":
            SellerProfile.objects.create(
                user=user,
                phone=phone or None,
                location=address or None,
                address=address or None,
                business_name=business_name or None,
                business_category=business_category or None,
                business_description=business_description or None,
                additional_info=additional_info or None,
                status="pending",
            )
        return user


class SellerRequestSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="username", read_only=True)
    phone = serializers.CharField(source="seller_profile.phone", read_only=True)
    address = serializers.CharField(source="seller_profile.address", read_only=True)
    business_name = serializers.CharField(source="seller_profile.business_name", read_only=True)
    business_category = serializers.CharField(source="seller_profile.business_category", read_only=True)
    business_description = serializers.CharField(source="seller_profile.business_description", read_only=True)
    additional_info = serializers.CharField(source="seller_profile.additional_info", read_only=True)
    status = serializers.CharField(source="seller_profile.status", read_only=True)
    reviewed_at = serializers.DateTimeField(source="seller_profile.reviewed_at", read_only=True)
    review_note = serializers.CharField(source="seller_profile.review_note", read_only=True)
    reviewed_by = serializers.CharField(source="seller_profile.reviewed_by.email", read_only=True)
    shops_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "owner_name",
            "email",
            "phone",
            "address",
            "business_name",
            "business_category",
            "business_description",
            "additional_info",
            "status",
            "date_joined",
            "reviewed_at",
            "review_note",
            "reviewed_by",
            "shops_count",
        ]

    def get_shops_count(self, obj):
        return obj.shops.count()


class SellerRequestReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    review_note = serializers.CharField(required=False, allow_blank=True)

    def save(self, **kwargs):
        seller = self.context["seller"]
        admin_user = self.context["request"].user
        profile = seller.seller_profile
        action = self.validated_data["action"]
        review_note = self.validated_data.get("review_note", "").strip()

        profile.status = "active" if action == "approve" else "rejected"
        profile.reviewed_at = timezone.now()
        profile.review_note = review_note or None
        profile.reviewed_by = admin_user if is_admin_user(admin_user) else None
        profile.verified = action == "approve"
        profile.save(
            update_fields=[
                "status",
                "reviewed_at",
                "review_note",
                "reviewed_by",
                "verified",
            ]
        )
        return seller


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        if user.role == "Seller":
            profile = getattr(user, "seller_profile", None)
            if not profile:
                raise AuthenticationFailed("Seller profile not found.")

            if profile.status == "pending":
                raise AuthenticationFailed("Your seller request is pending admin approval.")
            if profile.status == "rejected":
                raise AuthenticationFailed("Your seller request was rejected by admin.")
            if profile.status == "suspended":
                raise AuthenticationFailed("Your seller account is suspended.")
            if profile.status != "active":
                raise AuthenticationFailed("Your seller account is not active.")

        if is_admin_user(user):
            ensure_admin_shop(user)

        return data


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import Address
        model = Address
        fields = [
            'id',
            'full_name',
            'phone',
            'street',
            'city',
            'state',
            'zip_code',
            'country',
            'is_default',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CustomerUserSerializer(serializers.ModelSerializer):
    customer_profile = CustomerProfileSerializer(required=False)
    addresses = AddressSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'role',
            'customer_profile',
            'addresses',
        ]
        read_only_fields = ['id', 'email', 'role']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('customer_profile', None)
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update or create customer profile
        if profile_data:
            from .models import CustomerProfile
            profile, created = CustomerProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance


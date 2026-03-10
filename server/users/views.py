from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import SellerProfile
from .roles import is_admin_user
from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    SellerRequestReviewSerializer,
    SellerRequestSerializer,
    SellerSerializer,
    UserSerializer,
)
from .services import ensure_admin_shop

User = get_user_model()


class IsMainAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)


class CustomerRegisterView(generics.CreateAPIView):
    """Customer registration endpoint"""
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    
    def get_serializer_class(self):
        return CustomerRegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Return user data without sensitive information
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'message': 'Customer account created successfully'
        }, status=status.HTTP_201_CREATED)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        user = self.request.user
        ensure_admin_shop(user)
        return user


class SellerViewSet(viewsets.ModelViewSet):
    serializer_class = SellerSerializer
    permission_classes = [IsMainAdmin]

    def get_queryset(self):
        return User.objects.filter(role="Seller").select_related("seller_profile")

    @action(detail=True, methods=["put"])
    def update_status(self, request, pk=None):
        seller = self.get_object()
        try:
            profile = seller.seller_profile
            next_status = request.data.get("status")
            verified = request.data.get("verified")

            if next_status:
                profile.status = next_status
            if verified is not None:
                profile.verified = verified

            profile.save()
            return Response({"status": "status updated"})
        except SellerProfile.DoesNotExist:
            return Response({"error": "Profile not found"}, status=404)


class SellerRequestListAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsMainAdmin]

    def get(self, request):
        queryset = User.objects.filter(
            role="Seller",
            seller_profile__isnull=False,
        ).select_related("seller_profile", "seller_profile__reviewed_by")

        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(seller_profile__status=status_filter)

        serializer = SellerRequestSerializer(queryset.order_by("-date_joined"), many=True)
        return Response(serializer.data)


class SellerRequestReviewAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsMainAdmin]

    def patch(self, request, seller_id):
        seller = get_object_or_404(
            User.objects.select_related("seller_profile"),
            pk=seller_id,
            role="Seller",
        )
        if not hasattr(seller, "seller_profile"):
            return Response(
                {"detail": "Seller profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = SellerRequestReviewSerializer(
            data=request.data,
            context={"request": request, "seller": seller},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SellerRequestSerializer(seller).data, status=status.HTTP_200_OK)



class CustomerProfileView(generics.RetrieveUpdateAPIView):
    """Get and update customer profile"""
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_serializer_class(self):
        from .serializers import CustomerUserSerializer
        return CustomerUserSerializer

    def get_object(self):
        return self.request.user


class AddressViewSet(viewsets.ModelViewSet):
    """CRUD operations for customer addresses"""
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = None  # Disable pagination for addresses
    
    def get_serializer_class(self):
        from .serializers import AddressSerializer
        return AddressSerializer

    def get_queryset(self):
        from .models import Address
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set an address as default"""
        address = self.get_object()
        from .models import Address
        # Unset all other defaults
        Address.objects.filter(user=request.user, is_default=True).update(is_default=False)
        # Set this one as default
        address.is_default = True
        address.save()
        serializer = self.get_serializer(address)
        return Response(serializer.data)

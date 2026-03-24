from rest_framework import serializers
from .models import ChatSession, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'session', 'sender_type', 'content', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at', 'session', 'sender_type']

class ChatSessionSerializer(serializers.ModelSerializer):
    unread_count = serializers.SerializerMethodField()
    last_message_preview = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    assigned_admin_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ['id', 'user', 'session_id', 'assigned_admin', 'assigned_admin_name', 'status', 'last_message_at', 'created_at', 'unread_count', 'last_message_preview', 'customer_name']
        read_only_fields = ['id', 'created_at', 'last_message_at', 'unread_count', 'last_message_preview', 'assigned_admin_name']

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.is_staff:
            return obj.messages.filter(sender_type='customer', is_read=False).count()
        return obj.messages.filter(sender_type='admin', is_read=False).count()

    def get_last_message_preview(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return last_msg.content[:50] + ('...' if len(last_msg.content) > 50 else '')
        return None

    def get_customer_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name if name else (obj.user.username or obj.user.email)
        return "Anonymous Guest"
        
    def get_assigned_admin_name(self, obj):
        if obj.assigned_admin:
            name = f"{obj.assigned_admin.first_name} {obj.assigned_admin.last_name}".strip()
            return name if name else obj.assigned_admin.email
        return None

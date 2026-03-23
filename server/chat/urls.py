from django.urls import path
from .views import (
    SessionView, MessageView, MessageListView,
    AdminSessionListView, AdminAssignView, MarkReadView
)

urlpatterns = [
    # Customer endpoints
    path('session/', SessionView.as_view(), name='chat_session'),
    path('message/', MessageView.as_view(), name='send_message'),
    path('messages/', MessageListView.as_view(), name='fetch_messages'),
    path('read/', MarkReadView.as_view(), name='mark_read'),

    # Admin endpoints
    path('admin/sessions/', AdminSessionListView.as_view(), name='admin_sessions'),
    path('admin/assign/', AdminAssignView.as_view(), name='admin_assign'),
]

from rest_framework import generics, views, status, permissions
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from django.db.models import Count, Q, F, Max
from django.utils import timezone
from .models import ChatSession, ChatMessage
from .serializers import ChatSessionSerializer, ChatMessageSerializer

class MessageRateThrottle(SimpleRateThrottle):
    scope = 'chat_messages'
    rate = '1/s'

    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            return self.cache_format % {'scope': self.scope, 'ident': request.user.pk}
        
        # For anonymous users, try to use session_id from body or query params
        session_id = request.data.get('session_id') or request.query_params.get('session_id')
        if session_id:
            return self.cache_format % {'scope': self.scope, 'ident': session_id}
            
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

class SessionView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        session_id = request.data.get('session_id')

        # For authenticated users: find their most recent session (any status)
        if request.user.is_authenticated:
            session = (
                ChatSession.objects
                .filter(user=request.user)
                .order_by('-created_at')
                .first()
            )
            if session:
                # Reopen closed session instead of creating a duplicate
                if session.status == 'closed':
                    session.status = 'active'
                    session.save(update_fields=['status'])
                serializer = ChatSessionSerializer(session, context={'request': request})
                return Response(serializer.data)
            # No session at all — create one
            session = ChatSession.objects.create(user=request.user)

        else:
            # Anonymous: find by session_id
            if session_id:
                session = (
                    ChatSession.objects
                    .filter(session_id=session_id)
                    .order_by('-created_at')
                    .first()
                )
                if session:
                    if session.status == 'closed':
                        session.status = 'active'
                        session.save(update_fields=['status'])
                    serializer = ChatSessionSerializer(session, context={'request': request})
                    return Response(serializer.data)
            # No existing session — create one
            session = ChatSession.objects.create(
                user=None,
                session_id=session_id
            )

        serializer = ChatSessionSerializer(session, context={'request': request})
        return Response(serializer.data)

class MessageView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [MessageRateThrottle]

    def post(self, request):
        session_pk = request.data.get('session')
        content = request.data.get('content')
        sender_type = request.data.get('sender_type')

        if not session_pk or not content or not sender_type:
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = ChatSession.objects.get(pk=session_pk)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        # Basic security check
        if sender_type == 'admin' and not request.user.is_staff:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        if sender_type == 'customer' and session.status == 'closed':
            return Response({'error': 'Session is closed'}, status=status.HTTP_400_BAD_REQUEST)

        message = ChatMessage.objects.create(
            session=session,
            sender_type=sender_type,
            content=content
        )
        # Update last_message_at
        session.last_message_at = timezone.now()
        session.save(update_fields=['last_message_at'])

        serializer = ChatMessageSerializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class MessageListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        session_id = request.query_params.get('session_id')
        since_id = request.query_params.get('since_id')

        if not session_id:
            return Response({'error': 'session_id query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = ChatSession.objects.get(pk=session_id)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        queryset = session.messages.all().order_by('created_at')

        if since_id:
            try:
                since_msg = ChatMessage.objects.get(pk=since_id)
                queryset = list(queryset.filter(created_at__gt=since_msg.created_at))
            except ChatMessage.DoesNotExist:
                queryset = list(queryset)
        else:
            # Return last 50 messages initially (enough for scroll-up history)
            msgs = list(queryset)
            queryset = msgs[-50:] if len(msgs) > 50 else msgs

        serializer = ChatMessageSerializer(queryset, many=True)
        return Response(serializer.data)

class AdminSessionListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = ChatSessionSerializer
    pagination_class = None  # Return all sessions as plain array

    def get_queryset(self):
        # For authenticated users: show only their most recent session (no duplicates)
        # For anonymous: show all (they have unique session_ids)
        from django.db.models import Subquery, OuterRef

        # Get the most recent session id per user (for logged-in users)
        latest_per_user = (
            ChatSession.objects
            .filter(user=OuterRef('user'), user__isnull=False)
            .order_by('-created_at')
            .values('id')[:1]
        )

        return (
            ChatSession.objects
            .annotate(
                unread_count_admin=Count('messages', filter=Q(messages__sender_type='customer', messages__is_read=False)),
                latest_msg_time=Max('messages__created_at'),
            )
            .filter(
                Q(user__isnull=True) |  # all anonymous sessions
                Q(id__in=Subquery(
                    ChatSession.objects
                    .filter(user=OuterRef('user'), user__isnull=False)
                    .order_by('-created_at')
                    .values('id')[:1]
                ))
            )
            .order_by('-unread_count_admin', '-latest_msg_time', '-created_at')
        )

class AdminAssignView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        session_id = request.data.get('session_id')
        try:
            session = ChatSession.objects.get(pk=session_id)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        session.assigned_admin = request.user
        session.save()
        return Response({'success': True, 'assigned_admin': request.user.pk})

class MarkReadView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        session_id = request.data.get('session_id')
        sender_type = request.data.get('sender_type') 
        
        if not session_id or not sender_type:
            return Response({'error': 'Missing session_id or sender_type'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = ChatSession.objects.get(pk=session_id)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        # If customer calls, mark admin messages as read
        if sender_type == 'customer':
            session.messages.filter(sender_type='admin', is_read=False).update(is_read=True)
        elif sender_type == 'admin':
            if not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            session.messages.filter(sender_type='customer', is_read=False).update(is_read=True)

        return Response({'success': True})


class CloseSessionView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = ChatSession.objects.get(pk=session_id)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        # Admins can always close; customers can only close their own session
        if request.user.is_authenticated and request.user.is_staff:
            pass  # admin — allowed
        elif session.user and request.user.is_authenticated and session.user == request.user:
            pass  # owner — allowed
        elif not session.user:
            pass  # anonymous session — allowed
        else:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        session.status = 'closed'
        session.save(update_fields=['status'])
        serializer = ChatSessionSerializer(session)
        return Response(serializer.data)

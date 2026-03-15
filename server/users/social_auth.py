import json
import re
import secrets
import time
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import AuthenticationFailed

from .models import CustomerProfile
from .services import assert_user_can_authenticate, issue_tokens_for_user

User = get_user_model()

SOCIAL_STATE_MAX_AGE_SECONDS = 600


def _sanitize_next_path(next_path):
    if not next_path:
        return "/account"

    value = str(next_path).strip()
    if not value.startswith("/") or value.startswith("//"):
        return "/account"
    return value


def _require_setting(name):
    value = getattr(settings, name, "")
    if not value:
        raise RuntimeError(f"{name} is not configured.")
    return value


def _import_requests():
    try:
        import requests
    except ModuleNotFoundError as exc:
        raise RuntimeError("The requests package is required for social sign-in.") from exc
    return requests


def _backend_absolute_url(path):
    base_url = getattr(settings, "BACKEND_PUBLIC_URL", "").rstrip("/") or getattr(
        settings, "FRONTEND_URL", ""
    ).rstrip("/")
    if not base_url:
        raise RuntimeError("BACKEND_PUBLIC_URL is not configured.")
    return f"{base_url}{path}"


def _frontend_auth_url():
    frontend_url = getattr(settings, "SOCIAL_AUTH_FRONTEND_URL", "").rstrip("/") or getattr(
        settings, "FRONTEND_URL", ""
    ).rstrip("/")
    if not frontend_url:
        raise RuntimeError("SOCIAL_AUTH_FRONTEND_URL is not configured.")
    return f"{frontend_url}/auth"


def _redirect_to_frontend(next_path, provider, *, tokens=None, error_message=None):
    base_url = _frontend_auth_url()
    query = {}
    fragment = {}

    if provider:
        query["provider"] = provider
    if error_message:
        query["social_error"] = error_message
        if next_path:
            query["next"] = next_path
    elif tokens:
        fragment.update(tokens)
        fragment["next"] = next_path
        fragment["provider"] = provider

    query_string = urlencode(query)
    fragment_string = urlencode(fragment)
    location = base_url
    if query_string:
        location = f"{location}?{query_string}"
    if fragment_string:
        location = f"{location}#{fragment_string}"
    return HttpResponseRedirect(location)


def _social_error_message(provider, exc):
    if isinstance(exc, AuthenticationFailed):
        detail = exc.detail
        if isinstance(detail, (list, tuple)):
            return str(detail[0])
        return str(detail)
    if isinstance(exc, RuntimeError):
        return str(exc)

    if provider == "apple":
        return "Sign in with Apple could not be completed."
    return "Google sign-in could not be completed."


def encode_social_state(provider, next_path, *, nonce=None):
    payload = {
        "provider": provider,
        "next": _sanitize_next_path(next_path),
    }
    if nonce:
        payload["nonce"] = nonce
    return signing.dumps(payload, salt="users.social-auth")


def decode_social_state(state, provider):
    if not state:
        raise AuthenticationFailed("Login session expired. Please try again.")

    try:
        payload = signing.loads(
            state,
            salt="users.social-auth",
            max_age=SOCIAL_STATE_MAX_AGE_SECONDS,
        )
    except signing.BadSignature as exc:
        raise AuthenticationFailed("Login session expired. Please try again.") from exc
    except signing.SignatureExpired as exc:
        raise AuthenticationFailed("Login session expired. Please try again.") from exc

    if payload.get("provider") != provider:
        raise AuthenticationFailed("Invalid login session. Please try again.")

    payload["next"] = _sanitize_next_path(payload.get("next"))
    return payload


def _build_google_callback_url():
    return _backend_absolute_url(reverse("social-google-callback"))


def _build_apple_callback_url():
    return _backend_absolute_url(reverse("social-apple-callback"))


def exchange_google_code_for_identity(code):
    requests = _import_requests()
    client_id = _require_setting("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = _require_setting("GOOGLE_OAUTH_CLIENT_SECRET")
    redirect_uri = _build_google_callback_url()

    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
        timeout=15,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    id_token = token_data.get("id_token")
    if not id_token:
        raise AuthenticationFailed("Google did not return an identity token.")

    token_info_response = requests.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": id_token},
        timeout=15,
    )
    token_info_response.raise_for_status()
    token_info = token_info_response.json()

    audience = token_info.get("aud")
    if audience != client_id:
        raise AuthenticationFailed("Google token audience mismatch.")

    if str(token_info.get("email_verified", "")).lower() != "true":
        raise AuthenticationFailed("Your Google account email is not verified.")

    email = token_info.get("email")
    if not email:
        raise AuthenticationFailed("Google did not return an email address.")

    return {
        "email": email,
        "first_name": token_info.get("given_name", "") or "",
        "last_name": token_info.get("family_name", "") or "",
        "profile_photo": token_info.get("picture", "") or "",
    }


def _build_apple_client_secret():
    team_id = _require_setting("APPLE_OAUTH_TEAM_ID")
    key_id = _require_setting("APPLE_OAUTH_KEY_ID")
    client_id = _require_setting("APPLE_OAUTH_CLIENT_ID")
    private_key = _require_setting("APPLE_OAUTH_PRIVATE_KEY").replace("\\n", "\n")

    try:
        import jwt
    except ModuleNotFoundError as exc:
        raise RuntimeError("PyJWT is required for Apple sign-in.") from exc

    issued_at = int(time.time())
    return jwt.encode(
        {
            "iss": team_id,
            "iat": issued_at,
            "exp": issued_at + 86400 * 180,
            "aud": "https://appleid.apple.com",
            "sub": client_id,
        },
        private_key,
        algorithm="ES256",
        headers={"kid": key_id},
    )


def _parse_apple_user_payload(user_payload):
    if not user_payload:
        return {}

    try:
        data = json.loads(user_payload)
    except json.JSONDecodeError:
        return {}

    name = data.get("name") or {}
    return {
        "first_name": name.get("firstName", "") or "",
        "last_name": name.get("lastName", "") or "",
    }


def _decode_apple_identity_token(id_token, nonce=None):
    client_id = _require_setting("APPLE_OAUTH_CLIENT_ID")

    try:
        import jwt
    except ModuleNotFoundError as exc:
        raise RuntimeError("PyJWT is required for Apple sign-in.") from exc

    try:
        signing_key = jwt.PyJWKClient("https://appleid.apple.com/auth/keys").get_signing_key_from_jwt(
            id_token
        )
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer="https://appleid.apple.com",
        )
    except Exception as exc:
        raise AuthenticationFailed("Apple identity token is invalid.") from exc

    if nonce and claims.get("nonce") != nonce:
        raise AuthenticationFailed("Apple sign-in nonce validation failed.")

    email = claims.get("email")
    if not email:
        raise AuthenticationFailed("Apple did not return an email address.")

    email_verified = claims.get("email_verified")
    if str(email_verified).lower() not in {"true", "1"}:
        raise AuthenticationFailed("Your Apple account email is not verified.")

    return claims


def exchange_apple_code_for_identity(code, *, nonce=None, user_payload=None):
    requests = _import_requests()
    client_id = _require_setting("APPLE_OAUTH_CLIENT_ID")
    client_secret = _build_apple_client_secret()
    redirect_uri = _build_apple_callback_url()

    token_response = requests.post(
        "https://appleid.apple.com/auth/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
        timeout=15,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    id_token = token_data.get("id_token")
    if not id_token:
        raise AuthenticationFailed("Apple did not return an identity token.")

    claims = _decode_apple_identity_token(id_token, nonce=nonce)
    name_data = _parse_apple_user_payload(user_payload)

    return {
        "email": claims["email"],
        "first_name": name_data.get("first_name", ""),
        "last_name": name_data.get("last_name", ""),
    }


def _generate_unique_username(email, first_name="", last_name=""):
    source = " ".join(part for part in [first_name, last_name] if part).strip() or email.split("@")[0]
    base_username = re.sub(r"[^A-Za-z0-9._-]+", "", source.replace(" ", "_")).strip("._-") or "user"
    username = base_username[:150]
    counter = 1

    while User.objects.filter(username=username).exists():
        suffix = str(counter)
        username = f"{base_username[: max(1, 150 - len(suffix))]}{suffix}"
        counter += 1

    return username


def upsert_social_user(identity):
    email = identity["email"].strip().lower()
    user = User.objects.filter(email__iexact=email).first()

    if user is None:
        user = User(
            email=email,
            username=_generate_unique_username(
                email,
                first_name=identity.get("first_name", ""),
                last_name=identity.get("last_name", ""),
            ),
            role="Customer",
        )
        user.set_unusable_password()
        user.save()

    profile, _ = CustomerProfile.objects.get_or_create(user=user)
    updated = False

    if identity.get("first_name") and not profile.first_name:
        profile.first_name = identity["first_name"]
        updated = True
    if identity.get("last_name") and not profile.last_name:
        profile.last_name = identity["last_name"]
        updated = True
    if identity.get("profile_photo") and not profile.profile_photo:
        profile.profile_photo = identity["profile_photo"]
        updated = True

    if updated:
        profile.save()

    return user


class GoogleOAuthStartView(View):
    def get(self, request):
        next_path = _sanitize_next_path(request.GET.get("next"))

        try:
            client_id = _require_setting("GOOGLE_OAUTH_CLIENT_ID")
            callback_url = _build_google_callback_url()
        except Exception as exc:
            return _redirect_to_frontend(next_path, "google", error_message=_social_error_message("google", exc))

        state = encode_social_state("google", next_path)
        params = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": callback_url,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "access_type": "offline",
                "include_granted_scopes": "true",
                "prompt": "select_account",
            }
        )
        return HttpResponseRedirect(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


class GoogleOAuthCallbackView(View):
    def get(self, request):
        provider = "google"

        try:
            state_data = decode_social_state(request.GET.get("state"), provider)
        except Exception as exc:
            return _redirect_to_frontend("/account", provider, error_message=_social_error_message(provider, exc))

        next_path = state_data["next"]
        if request.GET.get("error"):
            message = request.GET.get("error_description") or request.GET.get("error")
            return _redirect_to_frontend(next_path, provider, error_message=message)

        code = request.GET.get("code")
        if not code:
            return _redirect_to_frontend(next_path, provider, error_message="Google did not return an authorization code.")

        try:
            identity = exchange_google_code_for_identity(code)
            user = upsert_social_user(identity)
            assert_user_can_authenticate(user)
            tokens = issue_tokens_for_user(user)
        except Exception as exc:
            return _redirect_to_frontend(next_path, provider, error_message=_social_error_message(provider, exc))

        return _redirect_to_frontend(next_path, provider, tokens=tokens)


class AppleOAuthStartView(View):
    def get(self, request):
        next_path = _sanitize_next_path(request.GET.get("next"))

        try:
            client_id = _require_setting("APPLE_OAUTH_CLIENT_ID")
            callback_url = _build_apple_callback_url()
        except Exception as exc:
            return _redirect_to_frontend(next_path, "apple", error_message=_social_error_message("apple", exc))

        nonce = secrets.token_urlsafe(24)
        state = encode_social_state("apple", next_path, nonce=nonce)
        params = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": callback_url,
                "response_type": "code",
                "response_mode": "form_post",
                "scope": "name email",
                "state": state,
                "nonce": nonce,
            }
        )
        return HttpResponseRedirect(f"https://appleid.apple.com/auth/authorize?{params}")


@method_decorator(csrf_exempt, name="dispatch")
class AppleOAuthCallbackView(View):
    def post(self, request):
        return self._handle_callback(request)

    def get(self, request):
        return self._handle_callback(request)

    def _handle_callback(self, request):
        provider = "apple"
        data = request.POST if request.method == "POST" else request.GET

        try:
            state_data = decode_social_state(data.get("state"), provider)
        except Exception as exc:
            return _redirect_to_frontend("/account", provider, error_message=_social_error_message(provider, exc))

        next_path = state_data["next"]
        if data.get("error"):
            message = data.get("error_description") or data.get("error")
            return _redirect_to_frontend(next_path, provider, error_message=message)

        code = data.get("code")
        if not code:
            return _redirect_to_frontend(next_path, provider, error_message="Apple did not return an authorization code.")

        try:
            identity = exchange_apple_code_for_identity(
                code,
                nonce=state_data.get("nonce"),
                user_payload=data.get("user"),
            )
            user = upsert_social_user(identity)
            assert_user_can_authenticate(user)
            tokens = issue_tokens_for_user(user)
        except Exception as exc:
            return _redirect_to_frontend(next_path, provider, error_message=_social_error_message(provider, exc))

        return _redirect_to_frontend(next_path, provider, tokens=tokens)

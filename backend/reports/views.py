import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.contrib.auth import authenticate, login
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import Report
from .serializers import ReportSerializer


def _format_readable_location(geocode_data, fallback_location):
    address = geocode_data.get("address", {}) if isinstance(geocode_data, dict) else {}

    street_line = " ".join(
        part for part in [
            address.get("house_number"),
            address.get("road") or address.get("pedestrian") or address.get("footway") or address.get("path"),
        ]
        if part
    )

    landmark_line = (
        address.get("hotel")
        or address.get("amenity")
        or address.get("building")
        or address.get("shop")
        or address.get("tourism")
        or address.get("leisure")
        or ""
    )

    area_line = (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("quarter")
        or address.get("village")
        or address.get("hamlet")
        or ""
    )

    city_line = (
        address.get("city")
        or address.get("municipality")
        or address.get("town")
        or address.get("county")
        or "Surigao City"
    )

    province_line = address.get("state") or address.get("region") or ""
    country_line = address.get("country") or ""
    primary_line = next((line for line in [landmark_line, street_line] if line), "") or street_line or landmark_line

    formatted = [part for part in [primary_line, area_line, city_line, province_line, country_line] if part]

    if formatted:
        return ", ".join(formatted)

    return geocode_data.get("display_name") or fallback_location


def _has_street_like_location(geocode_data):
    address = geocode_data.get("address", {}) if isinstance(geocode_data, dict) else {}

    return any(
        [
            address.get("road"),
            address.get("pedestrian"),
            address.get("footway"),
            address.get("path"),
            address.get("house_number"),
            address.get("hotel"),
            address.get("amenity"),
            address.get("building"),
            address.get("shop"),
        ]
    )


def _reverse_geocode_location(lat, lng):
    fallback_location = f"{lat:.6f}, {lng:.6f}"
    best_match = None

    for zoom_level in [18, 17, 16]:
        params = urlencode(
            {
                "format": "jsonv2",
                "addressdetails": 1,
                "namedetails": 1,
                "accept-language": "en",
                "zoom": zoom_level,
                "lat": lat,
                "lon": lng,
            }
        )
        request = Request(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={
                "User-Agent": "HapsayDalan/1.0 (Surigao City Traffic Reports)",
                "Accept": "application/json",
            },
        )

        try:
            with urlopen(request, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            continue

        if not isinstance(data, dict):
            continue

        best_match = data

        if _has_street_like_location(data):
            break

    return _format_readable_location(best_match or {}, fallback_location)


class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().order_by('-date_reported')
    serializer_class = ReportSerializer

    @action(detail=False, methods=["get"], url_path=r"by-reference/(?P<reference_id>[^/.]+)")
    def by_reference(self, request, reference_id=None):
        report = get_object_or_404(self.get_queryset(), reference_id__iexact=reference_id)
        serializer = self.get_serializer(report)
        return Response(serializer.data)


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_cookie_view(request):
    return Response(
        {
            "detail": "CSRF cookie set.",
            "csrfToken": get_token(request),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def reverse_geocode_view(request):
    try:
      lat = float(request.query_params.get("lat", ""))
      lng = float(request.query_params.get("lng", ""))
    except (TypeError, ValueError):
      return Response(
          {"detail": "Valid latitude and longitude are required."},
          status=status.HTTP_400_BAD_REQUEST,
      )

    location = _reverse_geocode_location(lat, lng)
    return Response({"location": location})


@api_view(["POST"])
@permission_classes([AllowAny])
def admin_login_view(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))

    if not username or not password:
        return Response(
            {"detail": "Please enter both username and password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)

    if user is None:
        return Response(
            {"detail": "Invalid email address or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_staff:
        return Response(
            {"detail": "This account does not have CTMO admin access."},
            status=status.HTTP_403_FORBIDDEN,
        )

    login(request, user)

    return Response(
        {
            "detail": "Login successful.",
            "admin_url": "/admin/",
            "username": user.get_username(),
        }
    )

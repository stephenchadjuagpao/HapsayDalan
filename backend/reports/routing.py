import json
import math
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle


class RouteThrottle(UserRateThrottle):
    scope = "report-routing"
    rate = "20/minute"


class PublicRouteThrottle(UserRateThrottle):
    scope = "public-report-routing"
    rate = "20/minute"


class RouteRequest(serializers.Serializer):
    start_lat = serializers.FloatField(min_value=-90, max_value=90)
    start_lng = serializers.FloatField(min_value=-180, max_value=180)
    end_lat = serializers.FloatField(min_value=-90, max_value=90)
    end_lng = serializers.FloatField(min_value=-180, max_value=180)
    preference = serializers.ChoiceField(choices=("shortest", "fastest"), default="shortest")

    def validate(self, attrs):
        for field in ("start_lat", "start_lng", "end_lat", "end_lng"):
            if not math.isfinite(attrs[field]):
                raise serializers.ValidationError({field: "A finite coordinate is required."})
        return attrs


@api_view(["GET"])
@permission_classes([IsAdminUser])
@throttle_classes([RouteThrottle])
def report_route(request):
    serializer = RouteRequest(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    return calculate_route(data)


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([PublicRouteThrottle])
def public_report_route(request):
    serializer = RouteRequest(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return calculate_route({**serializer.validated_data, "preference": "shortest"})


def calculate_route(data):
    if not settings.OPENROUTESERVICE_API_KEY:
        return Response({"detail": "Routing is not configured yet. Add a free Standard openrouteservice key to OPENROUTESERVICE_API_KEY in backend/.env, then restart the backend."}, status=503)
    cache_key = "road-route:" + ":".join(str(data[key]) for key in sorted(data))
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)
    provider_request = Request(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        data=json.dumps({"coordinates": [[data["start_lng"], data["start_lat"]],
                                          [data["end_lng"], data["end_lat"]]],
                         "preference": data["preference"], "instructions": True,
                         "units": "m", "language": "en"}).encode(),
        headers={"Authorization": settings.OPENROUTESERVICE_API_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(provider_request, timeout=15) as response:
            result = json.loads(response.read().decode())
        feature = result["features"][0]
        geometry = feature["geometry"]
        properties = feature["properties"]
        summary = properties["summary"]
        if geometry["type"] != "LineString" or len(geometry["coordinates"]) < 2:
            raise ValueError("Invalid route")
        for point in geometry["coordinates"]:
            if len(point) < 2 or not all(math.isfinite(value) for value in point[:2]) or abs(point[0]) > 180 or abs(point[1]) > 90:
                raise ValueError("Invalid route coordinate")
        if not all(math.isfinite(summary[field]) and summary[field] >= 0 for field in ("distance", "duration")):
            raise ValueError("Invalid route summary")
        payload = {"geometry": geometry, "distance": summary["distance"], "duration": summary["duration"],
                   "steps": [step for segment in properties.get("segments", []) for step in segment.get("steps", [])],
                   "preference": data["preference"], "provider": "openrouteservice"}
    except HTTPError as error:
        if error.code in (401, 403):
            return Response({"detail": "Routing key was rejected or its free daily quota has been reached. Check the HeiGIT dashboard."}, status=503)
        if error.code == 429:
            return Response({"detail": "Routing request limit reached. Wait a minute and try again."}, status=429)
        return Response({"detail": "No driving route could be calculated. Choose a starting point nearer a road and try again."}, status=422)
    except (URLError, OSError, ValueError, KeyError, IndexError, TypeError):
        return Response({"detail": "Routing service is unavailable. Please try again."}, status=503)
    cache.set(cache_key, payload, 300)
    return Response(payload)

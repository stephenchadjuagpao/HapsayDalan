from django.urls import path, re_path

from .urls import urlpatterns as backend_urls
from .cloud_views import health, frontend

urlpatterns = [
    path("healthz", health),
    *backend_urls,
    re_path(r"^(?!(?:api|admin|static|media)(?:/|$)).*$", frontend),
]

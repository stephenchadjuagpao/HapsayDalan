from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ReportViewSet, admin_login_view, csrf_cookie_view, reverse_geocode_view

router = DefaultRouter()
router.register(r'reports', ReportViewSet)

urlpatterns = [
    path("csrf/", csrf_cookie_view, name="csrf-cookie"),
    path("reverse-geocode/", reverse_geocode_view, name="reverse-geocode"),
    path("admin/login/", admin_login_view, name="admin-login"),
] + router.urls

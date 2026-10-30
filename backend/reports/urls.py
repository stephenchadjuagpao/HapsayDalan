from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ReportViewSet, admin_login_view, csrf_cookie_view, reverse_geocode_view
from .views import admin_password_reset_request, admin_password_reset_confirm
from .views import captcha_config_view
from .routing import report_route, public_report_route
from .submission_verification import request_submission_code, verify_submission_code
from .evidence import evidence_history, request_evidence, reply_evidence, evidence_file
from .activity import admin_activity_history
from .support import send_support_message, support_inbox, read_support_message, unread_message_count
from .advisories import public_advisories, admin_advisories, archive_advisory
from .staff_accounts import admin_me, admin_logout, staff_accounts, update_staff_account, resend_staff_invitation
from .officers import officers, officer_detail

router = DefaultRouter()
router.register(r'reports', ReportViewSet)

urlpatterns = [
    path("admin/officers/", officers, name="admin-officers"),
    path("admin/officers/<int:officer_id>/", officer_detail, name="admin-officer-detail"),
    path("advisories/", public_advisories, name="public-advisories"),
    path("admin/advisories/", admin_advisories, name="admin-advisories"),
    path("admin/advisories/<int:advisory_id>/archive/", archive_advisory, name="admin-advisory-archive"),
    path("support/messages/", send_support_message, name="support-message-send"),
    path("admin/messages/", support_inbox, name="support-inbox"),
    path("admin/messages/unread-count/", unread_message_count, name="support-unread-count"),
    path("admin/messages/<int:message_id>/read/", read_support_message, name="support-message-read"),
    path("admin/activity/", admin_activity_history, name="admin-activity-history"),
    path("reports/<int:report_id>/evidence/", evidence_history, name="report-evidence-history"),
    path("reports/<int:report_id>/evidence/request/", request_evidence, name="report-evidence-request"),
    path("reports/<int:report_id>/evidence/<uuid:request_id>/respond/", reply_evidence, name="report-evidence-reply"),
    path("reports/<int:report_id>/evidence/<uuid:request_id>/file/", evidence_file, name="report-evidence-file"),
    path("submission-email/request/", request_submission_code, name="submission-email-request"),
    path("submission-email/verify/", verify_submission_code, name="submission-email-verify"),
    path("public-report-route/", public_report_route, name="public-report-route"),
    path("report-route/", report_route, name="report-route"),
    path("captcha-config/", captcha_config_view, name="captcha-config"),
    path("csrf/", csrf_cookie_view, name="csrf-cookie"),
    path("reverse-geocode/", reverse_geocode_view, name="reverse-geocode"),
    path("admin/login/", admin_login_view, name="admin-login"),
    path("admin/me/", admin_me, name="admin-me"),
    path("admin/logout/", admin_logout, name="admin-logout"),
    path("admin/staff/", staff_accounts, name="admin-staff-accounts"),
    path("admin/staff/<int:user_id>/", update_staff_account, name="admin-staff-account-update"),
    path("admin/staff/<int:user_id>/invite/", resend_staff_invitation, name="admin-staff-account-invite"),
    path("admin/password-reset/", admin_password_reset_request, name="admin-password-reset"),
    path("admin/password-reset/confirm/", admin_password_reset_confirm, name="admin-password-reset-confirm"),
] + router.urls

import json
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(OPENROUTESERVICE_API_KEY="private-routing-key")
class RoutingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_user("routing-admin", is_staff=True)
        self.client.force_authenticate(self.admin)
        self.params = {"start_lat": 9.78, "start_lng": 125.48, "end_lat": 9.79, "end_lng": 125.49}
        self.provider = {"features": [{"geometry": {"type": "LineString", "coordinates": [[125.48, 9.78], [125.49, 9.79]]},
            "properties": {"summary": {"distance": 2000, "duration": 240},
                "segments": [{"steps": [{"instruction": "Turn left", "distance": 200}]}]}}]}

    @patch("reports.routing.urlopen")
    def test_route_is_staff_only(self, provider):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get("/api/report-route/", self.params).status_code, (401, 403))
        self.client.force_authenticate(User.objects.create_user("citizen"))
        self.assertEqual(self.client.get("/api/report-route/", self.params).status_code, 403)
        provider.assert_not_called()

    @patch("reports.routing.urlopen")
    def test_invalid_coordinates_and_preferences_never_reach_provider(self, provider):
        for changed in ({"start_lat": "NaN"}, {"end_lng": 181}, {"start_lat": ""}, {"preference": "fake"}):
            self.assertEqual(self.client.get("/api/report-route/", {**self.params, **changed}).status_code, 400)
        provider.assert_not_called()

    @override_settings(OPENROUTESERVICE_API_KEY="")
    @patch("reports.routing.urlopen")
    def test_missing_key_is_actionable(self, provider):
        response = self.client.get("/api/report-route/", self.params)
        self.assertEqual(response.status_code, 503)
        self.assertIn("free Standard", response.data["detail"])
        provider.assert_not_called()

    @patch("reports.routing.urlopen")
    def test_shortest_route_uses_lon_lat_and_is_cached_without_exposing_key(self, provider):
        provider.return_value = BytesIO(json.dumps(self.provider).encode())
        response = self.client.get("/api/report-route/", self.params)
        self.assertEqual(response.status_code, 200)
        request = provider.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(body["coordinates"], [[125.48, 9.78], [125.49, 9.79]])
        self.assertEqual(body["preference"], "shortest")
        self.assertEqual(request.get_header("Authorization"), "private-routing-key")
        self.assertEqual(response.data["distance"], 2000)
        self.assertNotIn("private-routing-key", response.content.decode())
        self.assertEqual(self.client.get("/api/report-route/", self.params).status_code, 200)
        self.assertEqual(provider.call_count, 1)

    @patch("reports.routing.urlopen")
    def test_provider_errors_do_not_return_fake_routes(self, provider):
        for failure, status in ((URLError("down"), 503), (HTTPError("url", 429, "quota", {}, None), 429),
                                (HTTPError("url", 403, "quota", {}, None), 503)):
            provider.side_effect = failure
            response = self.client.get("/api/report-route/", self.params)
            self.assertEqual(response.status_code, status)
            self.assertNotIn("geometry", response.data)

    @patch("reports.routing.urlopen")
    def test_public_form_gets_shortest_route_without_admin_login(self, provider):
        self.client.force_authenticate(None)
        provider.return_value = BytesIO(json.dumps(self.provider).encode())
        response = self.client.get("/api/public-report-route/", {**self.params, "preference": "fastest"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["preference"], "shortest")
        self.assertEqual(json.loads(provider.call_args.args[0].data)["preference"], "shortest")
        self.assertNotIn("private-routing-key", response.content.decode())

    @patch("reports.routing.urlopen")
    def test_public_route_is_rate_limited(self, provider):
        self.client.force_authenticate(None)
        provider.return_value = BytesIO(json.dumps(self.provider).encode())
        for _ in range(20):
            self.assertEqual(self.client.get("/api/public-report-route/", self.params).status_code, 200)
        self.assertEqual(self.client.get("/api/public-report-route/", self.params).status_code, 429)
        self.assertEqual(provider.call_count, 1)

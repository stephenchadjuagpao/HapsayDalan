import json
from unittest.mock import patch, MagicMock

from django.test import SimpleTestCase, RequestFactory, override_settings
from django.core.exceptions import DisallowedHost

from config.network import LocalNetworkHosts, current_lan_addresses
from .captcha import verify_report_captcha
from rest_framework.exceptions import ValidationError


def records(*addresses):
    return [(2, 1, 6, "", (address, 0)) for address in addresses]


class NetworkHostTests(SimpleTestCase):
    @patch("config.network.socket.getaddrinfo")
    def test_only_current_interface_private_ips_are_discovered(self, resolver):
        resolver.return_value = records("192.168.1.46", "10.0.0.2", "8.8.8.8", "127.0.0.1")
        self.assertEqual(current_lan_addresses(), {"192.168.1.46", "10.0.0.2"})
        resolver.side_effect = OSError("No adapter")
        self.assertEqual(current_lan_addresses(), set())

    @patch("config.network.socket.getaddrinfo")
    def test_request_host_tracks_network_change_without_allowing_arbitrary_ips(self, resolver):
        with override_settings(ALLOWED_HOSTS=LocalNetworkHosts(["localhost"])):
            resolver.return_value = records("192.168.1.46")
            self.assertEqual(RequestFactory().get("/", HTTP_HOST="192.168.1.46:3000").get_host(), "192.168.1.46:3000")
            resolver.return_value = records("192.168.20.8")
            self.assertEqual(RequestFactory().get("/", HTTP_HOST="192.168.20.8:3000").get_host(), "192.168.20.8:3000")
            for host in ("192.168.1.46", "192.168.20.9", "attacker.example"):
                with self.assertRaises(DisallowedHost):
                    RequestFactory().get("/", HTTP_HOST=host).get_host()


@override_settings(DEBUG=True, AUTO_LAN_HOSTS=True, RECAPTCHA_SITE_KEY="test-site",
                   RECAPTCHA_SECRET_KEY="test-secret", RECAPTCHA_ALLOWED_HOSTNAMES=["localhost"])
class MovingNetworkCaptchaTests(SimpleTestCase):
    def provider(self, result):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(result).encode()
        return patch("reports.captcha.urlopen", return_value=response)

    @patch("reports.captcha.current_lan_addresses")
    def test_captcha_accepts_current_server_ip_but_rejects_other_private_ips(self, addresses):
        addresses.return_value = {"192.168.1.46"}
        with self.provider({"success": True, "hostname": "192.168.1.46"}):
            verify_report_captcha("token")
        addresses.return_value = {"192.168.20.8"}
        with self.provider({"success": True, "hostname": "192.168.20.8"}):
            verify_report_captcha("token")
        for hostname in ("192.168.1.46", "192.168.20.9", "attacker.example"):
            with self.provider({"success": True, "hostname": hostname}), self.assertRaises(ValidationError):
                verify_report_captcha("token")
        with override_settings(DEBUG=False), self.provider({"success": True, "hostname": "192.168.20.8"}), self.assertRaises(ValidationError):
            verify_report_captcha("token")

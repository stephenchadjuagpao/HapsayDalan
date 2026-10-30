"""Current LAN addresses for local development; never trust a client-supplied IP."""
import ipaddress
import socket


LAN_NETWORKS = tuple(ipaddress.ip_network(value) for value in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
))


def current_lan_addresses():
    try:
        records = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
    except OSError:
        return set()
    addresses = set()
    for record in records:
        try:
            address = ipaddress.ip_address(record[4][0])
        except (ValueError, IndexError, TypeError):
            continue
        if any(address in network for network in LAN_NETWORKS):
            addresses.add(str(address))
    return addresses


class LocalNetworkHosts(list):
    """Django checks this list on each request, including after Wi-Fi changes."""
    def __iter__(self):
        return iter([*super().__iter__(), *sorted(current_lan_addresses())])

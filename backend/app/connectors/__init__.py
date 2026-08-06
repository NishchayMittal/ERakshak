from app.connectors.base import registry
from app.connectors.crtsh import CrtShConnector
from app.connectors.whois import WhoisConnector
from app.connectors.wayback import WaybackConnector
from app.connectors.username_enum import UsernameEnumConnector
from app.connectors.breach_lookup import BreachLookupConnector
from app.connectors.hibp import HaveIBeenPwnedConnector
from app.connectors.name_search import NameSearchConnector
from app.connectors.wallet_lookup import WalletLookupConnector
from app.connectors.dns_resolver import DnsResolverConnector
from app.connectors.github_commits import GithubCommitEmailConnector
from app.connectors.ip_geoloc import IpGeolocConnector
from app.connectors.shodan_idb import ShodanIdbConnector
from app.connectors.ocr_extractor import OcrExtractorConnector
from app.connectors.bucket_enum import BucketEnumConnector
from app.connectors.social_profiler import SocialProfilerConnector
from app.connectors.wikipedia_lookup import WikipediaConnector
from app.connectors.reverse_image import ReverseImageConnector
from app.connectors.exif_extractor import ExifExtractorConnector

_registered = False

def register_all():
    global _registered
    if _registered:
        return
    registry.register(CrtShConnector())
    registry.register(WhoisConnector())
    registry.register(WaybackConnector())
    registry.register(UsernameEnumConnector())
    registry.register(BreachLookupConnector())
    registry.register(HaveIBeenPwnedConnector())
    registry.register(NameSearchConnector())
    registry.register(WalletLookupConnector())
    registry.register(DnsResolverConnector())
    registry.register(GithubCommitEmailConnector())
    registry.register(IpGeolocConnector())
    registry.register(ShodanIdbConnector())
    registry.register(OcrExtractorConnector())
    registry.register(BucketEnumConnector())
    registry.register(SocialProfilerConnector())
    registry.register(WikipediaConnector())
    registry.register(ReverseImageConnector())
    registry.register(ExifExtractorConnector())
    _registered = True

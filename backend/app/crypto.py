import os
import json
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

import tempfile

KEY_FILE = os.path.join(tempfile.gettempdir(), "system_key.pem")

def get_or_create_private_key():
    if os.environ.get("AUDIT_PRIVATE_KEY"):
        key_data = os.environ["AUDIT_PRIVATE_KEY"].encode("utf-8")
        return serialization.load_pem_private_key(key_data, password=None)
        
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "rb") as f:
            return serialization.load_pem_private_key(f.read(), password=None)
            
    # Generate new key
    private_key = ec.generate_private_key(ec.SECP256R1())
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    with open(KEY_FILE, "wb") as f:
        f.write(pem)
    return private_key

def sign_payload(payload: dict | str) -> str:
    private_key = get_or_create_private_key()
    if isinstance(payload, dict):
        payload_bytes = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    else:
        payload_bytes = payload.encode("utf-8")
        
    signature = private_key.sign(
        payload_bytes,
        ec.ECDSA(hashes.SHA256())
    )
    return base64.b64encode(signature).decode("utf-8")

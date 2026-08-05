import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("webpush_service")

# Standard VAPID Public Key for NamiVerse Web Push Notifications
VAPID_PUBLIC_KEY = os.getenv(
    "VAPID_PUBLIC_KEY",
    "BPYCD9h9Wazpgp969ZcdtRS-nsYTD-SsPv-vqyOx7MkG_UwAhx_ytLKtY19ppPFsjcSPWao0IVxHAVb-1VbH7EI"
)
VAPID_PRIVATE_KEY = os.getenv(
    "VAPID_PRIVATE_KEY",
    "URo63_W4UEdho3DNi_XzxEzOQVHc9eHneDh_PT2HUG4"
)
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:nami@namiverse.app")

def get_vapid_public_key() -> str:
    return VAPID_PUBLIC_KEY

def send_nami_push(
    subscription_info: Dict[str, Any],
    title: str,
    body: str,
    url: str = "/calendar",
    icon: str = "/nami-wano-avatar.jpg",
    data: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Sends a Web Push Notification payload to a registered user device endpoint.
    """
    payload = {
        "title": title,
        "body": body,
        "icon": icon,
        "badge": "/icons/icon-192x192.png",
        "url": url,
        "timestamp": json.dumps(data) if data else None
    }

    payload_str = json.dumps(payload)

    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info={
                "endpoint": subscription_info["endpoint"],
                "keys": {
                    "p256dh": subscription_info["p256dh"],
                    "auth": subscription_info["auth"]
                }
            },
            data=payload_str,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIMS_EMAIL}
        )
        logger.info(f"Successfully sent Web Push to endpoint: {subscription_info['endpoint'][:30]}...")
        return True
    except ImportError:
        logger.warning("pywebpush not installed. Simulating Web Push payload dispatch.")
        return True
    except Exception as e:
        logger.error(f"Error sending Web Push notification: {e}")
        return False

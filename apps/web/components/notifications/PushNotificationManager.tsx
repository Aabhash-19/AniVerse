"use client";

import React, { useState, useEffect } from "react";
import { fetchWithCredentials, getApiUrl } from "@/lib/auth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);

      // Register SW
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.pushManager.getSubscription().then((sub) => {
            if (sub) {
              setIsSubscribed(true);
            }
          });
        })
        .catch((err) => {
          console.warn("ServiceWorker registration failed:", err);
        });
    }
  }, []);

  const subscribeUserToPush = async () => {
    setLoading(true);
    setStatusMsg("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatusMsg("Notification permission was denied in your browser settings.");
        setLoading(false);
        return;
      }

      // Fetch VAPID key
      const keyRes = await fetch(getApiUrl("/notifications/push/public-key"));
      if (!keyRes.ok) {
        throw new Error("Could not retrieve VAPID key");
      }
      const { public_key } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key),
        });
      }

      const rawJson = sub.toJSON();
      const payload = {
        endpoint: sub.endpoint,
        p256dh: rawJson.keys?.p256dh || "",
        auth: rawJson.keys?.auth || "",
      };

      const res = await fetchWithCredentials(getApiUrl("/notifications/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsSubscribed(true);
        setStatusMsg("Subscribed! Nami will notify you on your device when episodes air! 🍊");
      } else {
        setStatusMsg("Please log in to link push notifications to your account.");
      }
    } catch (err: any) {
      setStatusMsg(`Subscription failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerTestAlert = async () => {
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetchWithCredentials(getApiUrl("/notifications/push/test"), {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg("Nami broadcast alert sent! Check your phone/browser notifications! 🚀");
      } else {
        setStatusMsg(data.detail || "Failed to trigger test alert.");
      }
    } catch (err: any) {
      setStatusMsg("Failed to trigger test alert.");
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) return null;

  return (
    <div className="bg-zinc-900/60 border border-amber-500/20 rounded-3xl p-5 backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg shadow-sm">
            🔔
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-amber-300">Nami Airing Push Alerts</h4>
            <p className="text-xs text-zinc-400 font-medium">Get instant phone notifications when your watchlist episodes air!</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isSubscribed ? (
            <button
              onClick={subscribeUserToPush}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20 transition-all"
            >
              {loading ? "Enabling..." : "Enable Alerts 🍊"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                Active ✓
              </span>
              <button
                onClick={triggerTestAlert}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all"
              >
                Test Alert 🚀
              </button>
            </div>
          )}
        </div>
      </div>

      {statusMsg && (
        <p className="text-xs text-amber-300/90 font-medium bg-zinc-950/60 p-2.5 rounded-xl border border-amber-500/20">
          {statusMsg}
        </p>
      )}
    </div>
  );
}

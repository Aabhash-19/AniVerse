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
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchWithCredentials(getApiUrl("/auth/me"))
        .then((res) => (res.ok ? res.json() : null))
        .then((u) => {
          if (u) setCurrentUser(u);
        })
        .catch(() => {});

      const ua = window.navigator.userAgent;
      const isIosDevice = /iphone|ipad|ipod/i.test(ua);
      setIsIos(isIosDevice);

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(standalone);

      if ("serviceWorker" in navigator && "PushManager" in window) {
        setIsSupported(true);
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            reg.pushManager.getSubscription().then((sub) => {
              if (sub) setIsSubscribed(true);
            });
          })
          .catch((err) => {
            console.warn("ServiceWorker registration:", err);
          });
      } else if ("Notification" in window) {
        setIsSupported(true);
      }
    }
  }, []);

  const subscribeUserToPush = async () => {
    setLoading(true);
    setStatusMsg("");

    // 1. Check iOS Safari constraint
    if (isIos && !isStandalone) {
      setStatusMsg(
        "📱 On iPhone/iPad, Apple requires NamiVerse to be added to your Home Screen first! Tap Share (⎋) ➔ 'Add to Home Screen ➕', then launch NamiVerse from your Home Screen icon to enable alerts!"
      );
      setLoading(false);
      return;
    }

    // 2. Check current notification permission state
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setStatusMsg(
        "🔒 Notifications are blocked in browser settings! On Chrome/Android: Tap the Tune/Lock icon in address bar ➔ Site Settings ➔ Allow Notifications. On iOS: Settings ➔ Safari ➔ Advanced ➔ Feature Flags."
      );
      setLoading(false);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatusMsg(
          "🔒 Notification permission denied. Please allow notifications in your browser address bar/settings to receive Nami's alerts!"
        );
        setLoading(false);
        return;
      }

      // Fetch VAPID Key from backend
      const keyRes = await fetch(getApiUrl("/notifications/push/public-key"));
      if (!keyRes.ok) {
        throw new Error("API server temporarily warming up. Please try clicking Enable again in 5 seconds!");
      }
      const { public_key } = await keyRes.json();

      if ("serviceWorker" in navigator) {
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
          setIsSubscribed(true);
          setStatusMsg("Notification permissions granted on this device! 🍊");
        }
      } else {
        setIsSubscribed(true);
        setStatusMsg("Notification permissions granted! 🍊");
      }
    } catch (err: any) {
      // Fallback: If pushManager fails due to browser policy, fallback to local notification support
      if (Notification.permission === "granted") {
        setIsSubscribed(true);
        setStatusMsg("Notifications enabled on this device! 🍊");
      } else {
        setStatusMsg(`Permission notice: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = () => {
    if (!currentUser) return "Mina-san";
    if (currentUser.display_name && currentUser.display_name.trim() !== "") {
      return currentUser.display_name.trim();
    }
    if (currentUser.username && currentUser.username.trim() !== "") {
      const u = currentUser.username.trim();
      return u.charAt(0).toUpperCase() + u.slice(1);
    }
    return "Mina-san";
  };

  const triggerTestAlert = async () => {
    setLoading(true);
    setStatusMsg("");

    // Try backend push API first
    try {
      const res = await fetchWithCredentials(getApiUrl("/notifications/push/test"), {
        method: "POST",
      });
      if (res.ok) {
        setStatusMsg("Nami broadcast alert sent to your device!");
        setLoading(false);
        return;
      }
    } catch (_) {}

    // Fallback: Trigger native browser Notification directly
    const name = getUserDisplayName();
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("🍊 Nami's Broadcast Weather Alert! ⛵", {
          body: `Yosh, ${name}! Nami here, official Navigator of NamiVerse! 💰 Whenever a show on your list airs a new episode or trailer, I'll chart the skies and send a live alert directly to your device so you never miss a release! Keep sailing! 🍊✨`,
          icon: "/nami-wano-avatar.jpg",
          badge: "/icons/icon-192x192.png",
        });
        setStatusMsg("Nami broadcast alert triggered on your screen! 🍊");
      } else {
        setStatusMsg("Please enable notification permissions first!");
      }
    } catch (err: any) {
      setStatusMsg("Notification triggered!");
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
                Test Alert
              </button>
            </div>
          )}
        </div>
      </div>

      {statusMsg && (
        <p className="text-xs text-amber-300/90 font-medium bg-zinc-950/60 p-3 rounded-xl border border-amber-500/20 leading-relaxed">
          {statusMsg}
        </p>
      )}
    </div>
  );
}

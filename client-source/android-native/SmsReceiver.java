package com.blackgoldplc.bingopro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.telephony.SmsMessage;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SmsReceiver extends BroadcastReceiver {
    private static final String PREFS = "black_gold_sms_bridge";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;
        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;
        String format = bundle.getString("format");
        StringBuilder body = new StringBuilder();
        String sender = "";
        long receivedAt = System.currentTimeMillis();
        for (Object item : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) item, format);
            if (sms == null) continue;
            if (sender.isEmpty()) {
                sender = sms.getOriginatingAddress() == null ? "" : sms.getOriginatingAddress();
                receivedAt = sms.getTimestampMillis();
            }
            body.append(sms.getMessageBody());
        }
        if (!isBankSender(sender) || body.length() == 0 || body.length() > 4000) return;

        final String smsSender = sender;
        final String smsBody = body.toString();
        final long timestamp = receivedAt;
        final PendingResult pending = goAsync();
        EXECUTOR.execute(() -> {
            try {
                JSONObject event = new JSONObject();
                event.put("sender", smsSender);
                event.put("text", smsBody);
                event.put("receivedAt", timestamp);
                event.put("eventId", sha256(smsSender + "|" + timestamp + "|" + smsBody));
                enqueue(context, event);
                flushPending(context);
            } catch (Exception ignored) {
                // Never crash the SMS receiver; a later event or app reconnect can retry queued messages.
            } finally {
                pending.finish();
            }
        });
    }

    private static boolean isBankSender(String sender) {
        String normalized = sender == null ? "" : sender.toUpperCase().replaceAll("[^A-Z0-9]", "");
        return normalized.contains("TELEBIRR") || normalized.equals("CBE") ||
            normalized.contains("COMMERCIALBANK") || normalized.contains("LIONBANK");
    }

    private static String sha256(String value) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        for (byte b : bytes) out.append(String.format("%02x", b));
        return out.toString();
    }

    private static synchronized void enqueue(Context context, JSONObject event) throws Exception {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray queue = new JSONArray(prefs.getString("pending_events", "[]"));
        queue.put(event);
        while (queue.length() > 100) {
            JSONArray trimmed = new JSONArray();
            for (int i = 1; i < queue.length(); i++) trimmed.put(queue.get(i));
            queue = trimmed;
        }
        prefs.edit().putString("pending_events", queue.toString()).apply();
    }

    public static void flushPendingAsync(Context context) {
        EXECUTOR.execute(() -> flushPending(context));
    }

    public static synchronized void flushPending(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String apiUrl = prefs.getString("api_url", "");
        String token = prefs.getString("device_token", "");
        if (apiUrl.isEmpty() || token.isEmpty()) return;
        JSONArray queue;
        try {
            queue = new JSONArray(prefs.getString("pending_events", "[]"));
        } catch (Exception e) {
            prefs.edit().remove("pending_events").apply();
            return;
        }
        JSONArray remaining = new JSONArray();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject event = queue.optJSONObject(i);
            if (event == null || !post(apiUrl, token, event)) {
                if (event != null) remaining.put(event);
            }
        }
        prefs.edit().putString("pending_events", remaining.toString()).apply();
    }

    private static boolean post(String apiUrl, String token, JSONObject event) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(apiUrl.replaceAll("/+$", "") + "/api/webhooks/sms/device");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(3500);
            connection.setReadTimeout(4500);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] payload = event.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(payload.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(payload);
            }
            int status = connection.getResponseCode();
            return (status >= 200 && status < 300) || (status >= 400 && status < 500 && status != 401 && status != 403 && status != 429);
        } catch (Exception e) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}

package com.blackgoldplc.bingopro;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "SmsBridge",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.RECEIVE_SMS }) }
)
public class SmsBridgePlugin extends Plugin {
    private static final String PREFS = "black_gold_sms_bridge";

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("sms", call, "smsPermissionResult");
    }

    @PermissionCallback
    private void smsPermissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        String apiUrl = call.getString("apiUrl");
        String token = call.getString("token");
        if (apiUrl == null) apiUrl = "";
        if (token == null) token = "";
        if (!apiUrl.startsWith("https://") || token.length() < 40) {
            call.reject("Invalid secure SMS bridge configuration.");
            return;
        }
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString("api_url", apiUrl).putString("device_token", token).apply();
        SmsReceiver.flushPendingAsync(getContext());
        JSObject result = new JSObject();
        result.put("configured", true);
        call.resolve(result);
    }

    @PluginMethod
    public void status(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("permissionGranted", getPermissionState("sms") == PermissionState.GRANTED);
        result.put("configured", prefs.contains("api_url") && prefs.contains("device_token"));
        call.resolve(result);
    }
}

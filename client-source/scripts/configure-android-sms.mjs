import fs from 'node:fs';
import path from 'node:path';

const androidRoot = path.resolve('android/app/src/main');
const packageName = 'com.blackgoldplc.bingopro.adminsms';
const packagePath = path.join(androidRoot, 'java', ...packageName.split('.'));
fs.mkdirSync(packagePath, { recursive: true });

for (const file of ['SmsBridgePlugin.java', 'SmsReceiver.java']) {
  fs.copyFileSync(path.resolve('android-native', file), path.join(packagePath, file));
}

const manifestPath = path.join(androidRoot, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android.permission.RECEIVE_SMS')) {
  manifest = manifest.replace('<application', '<uses-permission android:name="android.permission.RECEIVE_SMS" />\n    <application');
}
if (!manifest.includes('.SmsReceiver')) {
  manifest = manifest.replace('</application>', `<receiver android:name=".SmsReceiver" android:enabled="true" android:exported="true" android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>
    </application>`);
}
fs.writeFileSync(manifestPath, manifest);

function findMainActivity(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') return full;
  }
  return null;
}
const mainActivityPath = findMainActivity(path.join(androidRoot, 'java'));
if (!mainActivityPath) throw new Error('Capacitor MainActivity.java was not found.');
let mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
if (!mainActivity.includes('registerPlugin(SmsBridgePlugin.class)')) {
  mainActivity = mainActivity.replace(/(package [^;]+;)/, '$1\n\nimport android.os.Bundle;');
  mainActivity = mainActivity.replace('public class MainActivity extends BridgeActivity {', `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }`);
}
fs.writeFileSync(mainActivityPath, mainActivity);
console.log('Installed Black Gold automatic SMS bridge into the generated Android project.');

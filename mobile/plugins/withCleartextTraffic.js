const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withCleartextTraffic(config) {
  // 1. Inject attributes into AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      mainApplication.$['android:usesCleartextTraffic'] = 'true';
      mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return config;
  });

  // 2. Ensure network_security_config.xml is created in android/app/src/main/res/xml/
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resXmlDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      if (!fs.existsSync(resXmlDir)) {
        fs.mkdirSync(resXmlDir, { recursive: true });
      }
      const xmlPath = path.join(resXmlDir, 'network_security_config.xml');
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.18.95</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
</network-security-config>`;
      fs.writeFileSync(xmlPath, xmlContent, 'utf-8');
      return config;
    },
  ]);

  return config;
};

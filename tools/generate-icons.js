const sharp = require('../backend/node_modules/sharp');
const fs = require('fs');
const path = require('path');

// Character SVG (image 1: cute pink squircle companion)
const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7675"/>
      <stop offset="100%" stop-color="#FE5150"/>
    </linearGradient>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7675"/>
      <stop offset="100%" stop-color="#E17055"/>
    </linearGradient>
    <linearGradient id="earLGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF8A7A"/>
      <stop offset="100%" stop-color="#FF7675"/>
    </linearGradient>
    <linearGradient id="earRGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7675"/>
      <stop offset="100%" stop-color="#E17055"/>
    </linearGradient>
    <linearGradient id="beakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFEAA7"/>
      <stop offset="100%" stop-color="#FDCB6E"/>
    </linearGradient>
    <filter id="bodyShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#801008" flood-opacity="0.32"/>
    </filter>
    <filter id="eyeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.14"/>
    </filter>
    <filter id="beakShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#801008" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- App Icon Background -->
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>

  <!-- Character Container Group centered -->
  <g transform="translate(512, 512)">
    <!-- Left Ear / Tuft -->
    <ellipse cx="-165" cy="-245" rx="60" ry="85" fill="url(#earLGrad)" transform="rotate(-22, -165, -245)"/>
    <!-- Right Ear / Tuft -->
    <ellipse cx="165" cy="-245" rx="60" ry="85" fill="url(#earRGrad)" transform="rotate(22, 165, -245)"/>

    <!-- Main Character Squircle Body with Outer Glow & Border -->
    <rect x="-300" y="-280" width="600" height="600" rx="195" fill="url(#bodyGrad)" filter="url(#bodyShadow)" stroke="rgba(255,255,255,0.85)" stroke-width="16"/>

    <!-- Specular Sheen / 3D Top Highlight -->
    <path d="M -288,-120 C -288,-260 -260,-270 -110,-270 L 110,-270 C 260,-270 288,-260 288,-120 C 180,-150 -180,-150 -288,-120 Z" fill="rgba(255,255,255,0.26)"/>

    <!-- Rosy Cheeks -->
    <ellipse cx="-195" cy="10" rx="45" ry="28" fill="rgba(255,118,117,0.48)"/>
    <ellipse cx="195" cy="10" rx="45" ry="28" fill="rgba(255,118,117,0.48)"/>

    <!-- Left Eye -->
    <g filter="url(#eyeShadow)">
      <circle cx="-105" cy="-20" r="100" fill="#FFFFFF"/>
      <!-- Pupil -->
      <circle cx="-95" cy="-15" r="62" fill="#1E272E"/>
      <!-- Specular Sparkle Highlight -->
      <circle cx="-78" cy="-32" r="24" fill="#FFFFFF"/>
      <circle cx="-110" cy="0" r="10" fill="#FFFFFF"/>
    </g>

    <!-- Right Eye -->
    <g filter="url(#eyeShadow)">
      <circle cx="105" cy="-20" r="100" fill="#FFFFFF"/>
      <!-- Pupil -->
      <circle cx="115" cy="-15" r="62" fill="#1E272E"/>
      <!-- Specular Sparkle Highlight -->
      <circle cx="132" cy="-32" r="24" fill="#FFFFFF"/>
      <circle cx="100" cy="0" r="10" fill="#FFFFFF"/>
    </g>

    <!-- Cute Beak / Mouth -->
    <g filter="url(#beakShadow)">
      <rect x="-75" y="80" width="150" height="90" rx="44" fill="url(#beakGrad)" stroke="#E17055" stroke-width="4"/>
      <path d="M -60,105 C -30,92 30,92 60,105 L 50,88 C 25,82 -25,82 -50,88 Z" fill="rgba(255,255,255,0.5)"/>
    </g>
  </g>
</svg>
`;

// Brand Header Logo SVG (Kidsko.ai + cute pink companion, replacing old owl logo in Image 3)
const headerLogoSvg = `
<svg width="450" height="194" viewBox="0 0 450 194" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="charBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7675"/>
      <stop offset="100%" stop-color="#FE5150"/>
    </linearGradient>
    <linearGradient id="charBeak" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFEAA7"/>
      <stop offset="100%" stop-color="#FDCB6E"/>
    </linearGradient>
  </defs>

  <!-- Background Pill (Soft Rounded Card) -->
  <rect x="4" y="4" width="442" height="186" rx="42" fill="#FFFFFF" stroke="rgba(254,81,80,0.18)" stroke-width="3"/>

  <!-- Kidsko.ai Brand Text -->
  <text x="32" y="125" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="64" fill="#FE5150" letter-spacing="-1">Kidsko<tspan fill="#FF7675">.ai</tspan></text>

  <!-- Cute Companion Mascot (Right side) -->
  <g transform="translate(365, 97)">
    <!-- Ears -->
    <ellipse cx="-26" cy="-40" rx="12" ry="18" fill="#FF8A7A" transform="rotate(-20, -26, -40)"/>
    <ellipse cx="26" cy="-40" rx="12" ry="18" fill="#E17055" transform="rotate(20, 26, -40)"/>
    <!-- Body -->
    <rect x="-54" y="-50" width="108" height="108" rx="34" fill="url(#charBg)" stroke="#FFFFFF" stroke-width="4"/>
    <!-- Sheen -->
    <path d="M -50,-24 C -50,-46 -46,-48 -20,-48 L 20,-48 C 46,-48 50,-46 50,-24 C 30,-30 -30,-30 -50,-24 Z" fill="rgba(255,255,255,0.3)"/>
    <!-- Cheeks -->
    <ellipse cx="-34" cy="2" rx="9" ry="6" fill="rgba(255,118,117,0.5)"/>
    <ellipse cx="34" cy="2" rx="9" ry="6" fill="rgba(255,118,117,0.5)"/>
    <!-- Eyes -->
    <circle cx="-18" cy="-5" r="18" fill="#FFFFFF"/>
    <circle cx="-16" cy="-4" r="11" fill="#1E272E"/>
    <circle cx="-13" cy="-7" r="4.5" fill="#FFFFFF"/>
    
    <circle cx="18" cy="-5" r="18" fill="#FFFFFF"/>
    <circle cx="20" cy="-4" r="11" fill="#1E272E"/>
    <circle cx="23" cy="-7" r="4.5" fill="#FFFFFF"/>
    <!-- Beak -->
    <rect x="-13" y="14" width="26" height="16" rx="8" fill="url(#charBeak)" stroke="#E17055" stroke-width="1"/>
  </g>
</svg>
`;

async function main() {
  const assetsDir = path.join(__dirname, '../mobile/assets');
  const svgBuf = Buffer.from(svg);
  const headerBuf = Buffer.from(headerLogoSvg);

  // 1. icon.png (1024x1024)
  await sharp(svgBuf)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('Generated icon.png');

  // 2. splash-icon.png (1024x1024)
  await sharp(svgBuf)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'splash-icon.png'));
  console.log('Generated splash-icon.png');

  // 3. android-icon-foreground.png (512x512)
  await sharp(svgBuf)
    .resize(512, 512)
    .png()
    .toFile(path.join(assetsDir, 'android-icon-foreground.png'));
  console.log('Generated android-icon-foreground.png');

  // 4. App-Icon.jpeg (1024x1024 JPEG replacing old owl)
  await sharp(svgBuf)
    .resize(1024, 1024)
    .jpeg({ quality: 95 })
    .toFile(path.join(assetsDir, 'App-Icon.jpeg'));
  console.log('Generated App-Icon.jpeg');

  // 5. favicon.png (48x48)
  await sharp(svgBuf)
    .resize(48, 48)
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));
  console.log('Generated favicon.png');

  // 6. header-logo.png (replacing old owl header logo in Image 3)
  await sharp(headerBuf)
    .resize(225, 97)
    .png()
    .toFile(path.join(assetsDir, 'header-logo.png'));
  console.log('Generated header-logo.png');

  console.log('All icons and brand logos generated successfully!');
}

main().catch(console.error);


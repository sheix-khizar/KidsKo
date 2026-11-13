const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../assets/animations');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Helper to create a static or animated scalar property
function val(v) {
  return { a: 0, k: v, ix: 1 };
}

function keyframes(kList) {
  return { a: 1, k: kList, ix: 1 };
}

function shapeEllipse(name, size, pos) {
  return {
    ty: 'el',
    d: 1,
    p: val(pos),
    s: val(size),
    nm: name,
    mn: 'ADBE Vector Shape - Ellipse',
    hd: false,
  };
}

function shapeFill(name, colorRgba) {
  return {
    ty: 'fl',
    c: val(colorRgba.slice(0, 3)),
    o: val(colorRgba[3] !== undefined ? colorRgba[3] * 100 : 100),
    r: 1,
    bm: 0,
    nm: name,
    mn: 'ADBE Vector Graphic - Fill',
    hd: false,
  };
}

function shapeStroke(name, colorRgba, width) {
  return {
    ty: 'st',
    c: val(colorRgba.slice(0, 3)),
    o: val(colorRgba[3] !== undefined ? colorRgba[3] * 100 : 100),
    w: val(width),
    lc: 2,
    lj: 2,
    nm: name,
    mn: 'ADBE Vector Graphic - Stroke',
    hd: false,
  };
}

function shapeGroup(name, elements, transform = {}) {
  return {
    ty: 'gr',
    it: [
      ...elements,
      {
        ty: 'tr',
        p: transform.p || val([0, 0]),
        a: transform.a || val([0, 0]),
        s: transform.s || val([100, 100]),
        r: transform.r || val(0),
        o: transform.o || val(100),
        sk: val(0),
        sa: val(0),
        nm: 'Transform',
      },
    ],
    nm: name,
    mn: 'ADBE Vector Group',
    hd: false,
  };
}

function createLayer(index, name, shapes, ks = {}, op = 60) {
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: ks.o || val(100),
      r: ks.r || val(0),
      p: ks.p || val([150, 150, 0]),
      a: ks.a || val([0, 0, 0]),
      s: ks.s || val([100, 100, 100]),
    },
    ao: 0,
    shapes: shapes,
    ip: 0,
    op: op,
    st: 0,
    bm: 0,
  };
}

// -------------------------------------------------------------
// 1. OWL IDLE ANIMATION (Soft Breathing & Natural Blinking)
// -------------------------------------------------------------
function buildIdleJson() {
  const op = 60; // 2 seconds at 30 fps
  
  // Body breathing scale keyframes
  const bodyScale = keyframes([
    { t: 0, s: [100, 100, 100], e: [102, 98, 100] },
    { t: 30, s: [102, 98, 100], e: [100, 100, 100] },
    { t: 60, s: [100, 100, 100] },
  ]);

  // Eye blinking keyframes (quick blink at frame 25-28 and 52-55)
  const eyeScale = keyframes([
    { t: 0, s: [100, 100, 100], e: [100, 100, 100] },
    { t: 24, s: [100, 100, 100], e: [100, 10, 100] },
    { t: 26, s: [100, 10, 100], e: [100, 100, 100] },
    { t: 28, s: [100, 100, 100], e: [100, 100, 100] },
    { t: 52, s: [100, 100, 100], e: [100, 10, 100] },
    { t: 54, s: [100, 10, 100], e: [100, 100, 100] },
    { t: 56, s: [100, 100, 100] },
  ]);

  const layers = [
    // Beak
    createLayer(1, 'Beak', [
      shapeGroup('BeakGroup', [
        shapeEllipse('BeakOval', [24, 18], [0, 12]),
        shapeFill('BeakFill', [1, 0.62, 0.26, 1]), // Coral orange #FF9F43
      ])
    ], { p: val([150, 150, 0]) }, op),

    // Eyes
    createLayer(2, 'Eyes', [
      // Left eye
      shapeGroup('EyeL', [
        shapeEllipse('PupilL', [12, 12], [-28, -6]),
        shapeFill('PupilLFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisL', [34, 34], [-28, -6]),
        shapeFill('IrisLFill', [1, 1, 1, 1]),
      ]),
      // Right eye
      shapeGroup('EyeR', [
        shapeEllipse('PupilR', [12, 12], [28, -6]),
        shapeFill('PupilRFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisR', [34, 34], [28, -6]),
        shapeFill('IrisRFill', [1, 1, 1, 1]),
      ]),
    ], { p: val([150, 150, 0]), s: eyeScale }, op),

    // Eyeglass Frame (Cute nerd owl look)
    createLayer(3, 'Glasses', [
      shapeGroup('GlassesGroup', [
        shapeEllipse('GlassL', [42, 42], [-28, -6]),
        shapeStroke('GlassLStroke', [1, 0.42, 0.42, 1], 4), // Coral #FF6B6B
        shapeEllipse('GlassR', [42, 42], [28, -6]),
        shapeStroke('GlassRStroke', [1, 0.42, 0.42, 1], 4),
      ])
    ], { p: val([150, 150, 0]) }, op),

    // Body & Face
    createLayer(4, 'Body', [
      // Ear tuft L
      shapeGroup('EarL', [
        shapeEllipse('EarLShape', [32, 44], [-52, -56]),
        shapeFill('EarLFill', [1, 0.42, 0.42, 1]), // Coral
      ]),
      // Ear tuft R
      shapeGroup('EarR', [
        shapeEllipse('EarRShape', [32, 44], [52, -56]),
        shapeFill('EarRFill', [1, 0.62, 0.26, 1]), // Orange
      ]),
      // Main Body
      shapeGroup('BodyGroup', [
        shapeEllipse('BodyShape', [136, 136], [0, 0]),
        shapeFill('BodyFill', [1, 0.94, 0.88, 1]), // Warm cream
        shapeStroke('BodyStroke', [1, 0.42, 0.42, 1], 6),
      ]),
      // Chest tummy patch
      shapeGroup('Belly', [
        shapeEllipse('BellyShape', [92, 70], [0, 30]),
        shapeFill('BellyFill', [1, 0.98, 0.95, 1]),
      ])
    ], { p: val([150, 150, 0]), s: bodyScale }, op),
  ];

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: op,
    w: 300,
    h: 300,
    nm: 'Kidsko Owl Idle',
    ddd: 0,
    assets: [],
    layers: layers,
  };
}

// -------------------------------------------------------------
// 2. OWL LISTENING ANIMATION (Audio Wave Rings + Attentive Tilt)
// -------------------------------------------------------------
function buildListeningJson() {
  const op = 60;

  // Pulse rings expanding outward
  const ring1Scale = keyframes([
    { t: 0, s: [60, 60, 100], e: [140, 140, 100] },
    { t: 40, s: [140, 140, 100], e: [140, 140, 100] },
    { t: 60, s: [140, 140, 100] },
  ]);
  const ring1Opacity = keyframes([
    { t: 0, s: [80], e: [0] },
    { t: 40, s: [0], e: [0] },
    { t: 60, s: [0] },
  ]);

  const ring2Scale = keyframes([
    { t: 0, s: [100, 100, 100], e: [100, 100, 100] },
    { t: 20, s: [60, 60, 100], e: [140, 140, 100] },
    { t: 60, s: [140, 140, 100] },
  ]);
  const ring2Opacity = keyframes([
    { t: 0, s: [0], e: [0] },
    { t: 20, s: [80], e: [0] },
    { t: 60, s: [0] },
  ]);

  // Subtle curious head tilt
  const headRot = keyframes([
    { t: 0, s: [-4], e: [5] },
    { t: 30, s: [5], e: [-4] },
    { t: 60, s: [-4] },
  ]);

  const layers = [
    // Audio ripple rings
    createLayer(1, 'AudioWaves', [
      shapeGroup('WaveRing1', [
        shapeEllipse('Ring1', [150, 150], [0, 0]),
        shapeStroke('Ring1Stroke', [0.31, 0.8, 0.77, 1], 4), // Mint/Sky #4ECDC4
      ], { s: ring1Scale, o: ring1Opacity }),
      shapeGroup('WaveRing2', [
        shapeEllipse('Ring2', [150, 150], [0, 0]),
        shapeStroke('Ring2Stroke', [0.45, 0.73, 1, 1], 3), // Blue #74B9FF
      ], { s: ring2Scale, o: ring2Opacity }),
    ], { p: val([150, 150, 0]) }, op),

    // Beak
    createLayer(2, 'Beak', [
      shapeGroup('BeakGroup', [
        shapeEllipse('BeakOval', [22, 16], [0, 12]),
        shapeFill('BeakFill', [1, 0.62, 0.26, 1]),
      ])
    ], { p: val([150, 150, 0]), r: headRot }, op),

    // Big attentive eyes
    createLayer(3, 'Eyes', [
      shapeGroup('EyeL', [
        shapeEllipse('PupilL', [14, 14], [-28, -6]),
        shapeFill('PupilLFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisL', [36, 36], [-28, -6]),
        shapeFill('IrisLFill', [1, 1, 1, 1]),
      ]),
      shapeGroup('EyeR', [
        shapeEllipse('PupilR', [14, 14], [28, -6]),
        shapeFill('PupilRFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisR', [36, 36], [28, -6]),
        shapeFill('IrisRFill', [1, 1, 1, 1]),
      ]),
    ], { p: val([150, 150, 0]), r: headRot }, op),

    // Glasses
    createLayer(4, 'Glasses', [
      shapeGroup('GlassesGroup', [
        shapeEllipse('GlassL', [44, 44], [-28, -6]),
        shapeStroke('GlassLStroke', [0.31, 0.8, 0.77, 1], 4), // Teal glasses for listening
        shapeEllipse('GlassR', [44, 44], [28, -6]),
        shapeStroke('GlassRStroke', [0.31, 0.8, 0.77, 1], 4),
      ])
    ], { p: val([150, 150, 0]), r: headRot }, op),

    // Body
    createLayer(5, 'Body', [
      shapeGroup('EarL', [
        shapeEllipse('EarLShape', [34, 46], [-52, -56]),
        shapeFill('EarLFill', [0.31, 0.8, 0.77, 1]),
      ]),
      shapeGroup('EarR', [
        shapeEllipse('EarRShape', [34, 46], [52, -56]),
        shapeFill('EarRFill', [0.45, 0.73, 1, 1]),
      ]),
      shapeGroup('BodyGroup', [
        shapeEllipse('BodyShape', [136, 136], [0, 0]),
        shapeFill('BodyFill', [1, 0.96, 0.92, 1]),
        shapeStroke('BodyStroke', [0.31, 0.8, 0.77, 1], 6),
      ]),
    ], { p: val([150, 150, 0]), r: headRot }, op),
  ];

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: op,
    w: 300,
    h: 300,
    nm: 'Kidsko Owl Listening',
    ddd: 0,
    assets: [],
    layers: layers,
  };
}

// -------------------------------------------------------------
// 3. OWL THINKING ANIMATION (Curious eyes & Pulsing thoughts)
// -------------------------------------------------------------
function buildThinkingJson() {
  const op = 60;

  // Thought bubbles floating and pulsing
  const bubbleScale = keyframes([
    { t: 0, s: [70, 70, 100], e: [110, 110, 100] },
    { t: 30, s: [110, 110, 100], e: [70, 70, 100] },
    { t: 60, s: [70, 70, 100] },
  ]);

  const eyesLookingUp = keyframes([
    { t: 0, s: [-28, -12, 0], e: [-28, -16, 0] },
    { t: 30, s: [-28, -16, 0], e: [-28, -12, 0] },
    { t: 60, s: [-28, -12, 0] },
  ]);

  const layers = [
    // Floating thought bubbles
    createLayer(1, 'Thoughts', [
      shapeGroup('Bubble1', [
        shapeEllipse('B1', [14, 14], [52, -75]),
        shapeFill('B1Fill', [1, 0.9, 0.43, 1]), // Sun yellow #FFE66D
      ], { s: bubbleScale }),
      shapeGroup('Bubble2', [
        shapeEllipse('B2', [22, 22], [70, -96]),
        shapeFill('B2Fill', [1, 0.7, 0.28, 1]), // Warm amber
      ], { s: bubbleScale }),
    ], { p: val([150, 150, 0]) }, op),

    // Beak
    createLayer(2, 'Beak', [
      shapeGroup('BeakGroup', [
        shapeEllipse('BeakOval', [20, 14], [2, 10]),
        shapeFill('BeakFill', [1, 0.62, 0.26, 1]),
      ])
    ], { p: val([150, 150, 0]) }, op),

    // Looking Up Eyes
    createLayer(3, 'Eyes', [
      shapeGroup('EyeL', [
        shapeEllipse('PupilL', [12, 12], [-28, -12]),
        shapeFill('PupilLFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisL', [34, 34], [-28, -6]),
        shapeFill('IrisLFill', [1, 1, 1, 1]),
      ]),
      shapeGroup('EyeR', [
        shapeEllipse('PupilR', [12, 12], [28, -12]),
        shapeFill('PupilRFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisR', [34, 34], [28, -6]),
        shapeFill('IrisRFill', [1, 1, 1, 1]),
      ]),
    ], { p: val([150, 150, 0]) }, op),

    // Body
    createLayer(4, 'Body', [
      shapeGroup('BodyGroup', [
        shapeEllipse('BodyShape', [136, 136], [0, 0]),
        shapeFill('BodyFill', [1, 0.98, 0.9, 1]),
        shapeStroke('BodyStroke', [1, 0.8, 0.35, 1], 6), // Yellow/amber stroke
      ]),
    ], { p: val([150, 150, 0]) }, op),
  ];

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: op,
    w: 300,
    h: 300,
    nm: 'Kidsko Owl Thinking',
    ddd: 0,
    assets: [],
    layers: layers,
  };
}

// -------------------------------------------------------------
// 4. OWL SPEAKING ANIMATION (Mouth Flapping & Cheerful Bobbing)
// -------------------------------------------------------------
function buildSpeakingJson() {
  const op = 60;

  // Mouth / Beak flapping rhythmically
  const beakFlap = keyframes([
    { t: 0, s: [100, 100, 100], e: [110, 170, 100] },
    { t: 8, s: [110, 170, 100], e: [100, 80, 100] },
    { t: 16, s: [100, 80, 100], e: [110, 180, 100] },
    { t: 24, s: [110, 180, 100], e: [100, 90, 100] },
    { t: 32, s: [100, 90, 100], e: [110, 160, 100] },
    { t: 40, s: [110, 160, 100], e: [100, 80, 100] },
    { t: 48, s: [100, 80, 100], e: [110, 170, 100] },
    { t: 56, s: [110, 170, 100], e: [100, 100, 100] },
    { t: 60, s: [100, 100, 100] },
  ]);

  // Body cheerful speaking bob
  const bodyBob = keyframes([
    { t: 0, s: [150, 150, 0], e: [150, 144, 0] },
    { t: 15, s: [150, 144, 0], e: [150, 150, 0] },
    { t: 30, s: [150, 150, 0], e: [150, 144, 0] },
    { t: 45, s: [150, 144, 0], e: [150, 150, 0] },
    { t: 60, s: [150, 150, 0] },
  ]);

  const layers = [
    // Flapping Beak with open mouth interior
    createLayer(1, 'Beak', [
      shapeGroup('MouthOpen', [
        shapeEllipse('MouthInterior', [18, 22], [0, 16]),
        shapeFill('MouthFill', [0.85, 0.22, 0.22, 1]), // Red mouth
      ]),
      shapeGroup('BeakTop', [
        shapeEllipse('BeakShape', [26, 18], [0, 8]),
        shapeFill('BeakFill', [1, 0.62, 0.26, 1]),
      ]),
    ], { p: val([150, 150, 0]), s: beakFlap }, op),

    // Expressive Talking Eyes
    createLayer(2, 'Eyes', [
      shapeGroup('EyeL', [
        shapeEllipse('PupilL', [13, 13], [-28, -6]),
        shapeFill('PupilLFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisL', [36, 36], [-28, -6]),
        shapeFill('IrisLFill', [1, 1, 1, 1]),
      ]),
      shapeGroup('EyeR', [
        shapeEllipse('PupilR', [13, 13], [28, -6]),
        shapeFill('PupilRFill', [0.12, 0.14, 0.18, 1]),
        shapeEllipse('IrisR', [36, 36], [28, -6]),
        shapeFill('IrisRFill', [1, 1, 1, 1]),
      ]),
    ], { p: val([150, 150, 0]) }, op),

    // Glasses
    createLayer(3, 'Glasses', [
      shapeGroup('GlassesGroup', [
        shapeEllipse('GlassL', [44, 44], [-28, -6]),
        shapeStroke('GlassLStroke', [1, 0.42, 0.42, 1], 4),
        shapeEllipse('GlassR', [44, 44], [28, -6]),
        shapeStroke('GlassRStroke', [1, 0.42, 0.42, 1], 4),
      ])
    ], { p: val([150, 150, 0]) }, op),

    // Body with wing gestures
    createLayer(4, 'Body', [
      // Left Wing flapping
      shapeGroup('WingL', [
        shapeEllipse('WingLShape', [38, 70], [-68, 6]),
        shapeFill('WingLFill', [1, 0.42, 0.42, 1]), // Coral wing
      ]),
      // Right Wing flapping
      shapeGroup('WingR', [
        shapeEllipse('WingRShape', [38, 70], [68, 6]),
        shapeFill('WingRFill', [1, 0.62, 0.26, 1]), // Orange wing
      ]),
      // Main Body
      shapeGroup('BodyGroup', [
        shapeEllipse('BodyShape', [136, 136], [0, 0]),
        shapeFill('BodyFill', [1, 0.94, 0.88, 1]),
        shapeStroke('BodyStroke', [1, 0.42, 0.42, 1], 6),
      ]),
    ], { p: bodyBob }, op),
  ];

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: op,
    w: 300,
    h: 300,
    nm: 'Kidsko Owl Speaking',
    ddd: 0,
    assets: [],
    layers: layers,
  };
}

fs.writeFileSync(path.join(outDir, 'owl_idle.json'), JSON.stringify(buildIdleJson(), null, 2));
fs.writeFileSync(path.join(outDir, 'owl_listening.json'), JSON.stringify(buildListeningJson(), null, 2));
fs.writeFileSync(path.join(outDir, 'owl_thinking.json'), JSON.stringify(buildThinkingJson(), null, 2));
fs.writeFileSync(path.join(outDir, 'owl_speaking.json'), JSON.stringify(buildSpeakingJson(), null, 2));

console.log('✅ Generated 4 Lottie character animation files in mobile/assets/animations/:');
console.log(' - owl_idle.json');
console.log(' - owl_listening.json');
console.log(' - owl_thinking.json');
console.log(' - owl_speaking.json');


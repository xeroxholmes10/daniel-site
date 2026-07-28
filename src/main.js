import * as THREE from "three";

const IMAGE_SRC = "/daniel.jpg?v=" + Date.now();
const stage = document.getElementById("particle-stage");
const heroWrap = document.querySelector(".hero-wrap");
const heroEl = document.querySelector(".hero");

/* ---------- renderer / scene / camera ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.z = 46;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const scaleMats = [];
// dot-size-per-pixel constant, tied to actual stage height so the dot/face
// size RATIO stays constant regardless of window size (a fixed SIZE_K alone
// doesn't scale with a taller/shorter hero and reads "smoother" on big screens)
const SIZE_K_PER_HEIGHT = 1.55;
function sizeToStage() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  // updateStyle=true (default): sets the canvas CSS size to exactly w x h so it
  // displays at section size on ANY display scaling. The old `false` left the
  // CSS size unset, so on high-DPI/Windows-scaled screens the backing buffer was
  // larger than the section and the render got clipped/offset (empty edges).
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pix = renderer.getPixelRatio();
  const sizeK = h * SIZE_K_PER_HEIGHT;
  scaleMats.forEach((m) => {
    m.uniforms.uScale.value = sizeK;
    m.uniforms.uPix.value = pix;
  });
}
sizeToStage();
window.addEventListener("resize", sizeToStage);

/* ---------- pointer (listens on the whole hero, not just the canvas —
   reference tracks window-wide movement so tilt reacts even over the text) --- */
const mouseTarget = new THREE.Vector2(0, 0); // normalized -1..1
const mouseSmooth = new THREE.Vector2(0, 0);
let mouseActive = false;
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouseWorld = new THREE.Vector3(9999, 9999, 0);
const mouseLocal = new THREE.Vector3(9999, 9999, 0);
// cursor-SPEED tracking: the explosion force scales with how fast the cursor
// moves, so a still/slow cursor near the face does almost nothing, while a fast
// sweep produces the big burst (video-matched). removes the "too sensitive" feel
const prevMouseWorld = new THREE.Vector3();
let prevMouseValid = false;
let mouseSpeedSmooth = 0;
let hasMouseWorld = false;
let forceScale = 0;
const SPEED_DEAD = 0.12; // world units/frame below which nothing happens
const SPEED_FULL = 1.6;  // cursor speed for a full-strength explosion

heroWrap.addEventListener("pointermove", (e) => {
  const r = stage.getBoundingClientRect();
  mouseTarget.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouseTarget.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  mouseActive = true;
});
heroWrap.addEventListener("pointerleave", () => {
  mouseActive = false;
});

/* ---------- particle system ---------- */
let sys = null;
const CENTER_X = 6; // face nudged right of the copy
const FACE_TARGET_H = 44; // world-units tall. scales around (CENTER_X, CENTER_Y)
                          // so changing this resizes in place — the centering
                          // does NOT move

function build(img) {
  sizeToStage(); // guard against a stale/transient aspect ratio at image-load time

  // the stage now spans nav+hero together (so particles can show behind the
  // logo/menu too) — compensate so the face still centers on the OLD hero-only
  // area instead of drifting up into the nav band
  const vFOV0 = (camera.fov * Math.PI) / 180;
  const visH0 = 2 * Math.tan(vFOV0 / 2) * camera.position.z;
  const stageRect = stage.getBoundingClientRect();
  const heroRect = heroEl.getBoundingClientRect();
  const oldHeroCenterPx = heroRect.top - stageRect.top + heroRect.height / 2;
  const newStageCenterPx = stageRect.height / 2;
  const worldPerPx = visH0 / (stageRect.height || 1);
  const CENTER_Y = -(oldHeroCenterPx - newStageCenterPx) * worldPerPx;

  /* --- sample face from image --- */
  const MAX = 260; // lower than a photo-sharp sampling: keeps gaps between dots
                    // visible (reads as "built from particles", not a blurred photo)
  const ratio = img.height / img.width;
  const cw = MAX;
  const ch = Math.round(MAX * ratio);
  const cv = document.createElement("canvas");
  cv.width = cw;
  cv.height = ch;
  const cx = cv.getContext("2d");
  cx.drawImage(img, 0, 0, cw, ch);
  const px = cx.getImageData(0, 0, cw, ch).data;

  const scale = FACE_TARGET_H / ch;
  const threshold = 0.1;
  const marginX = 0.02; // safety trim only (approved photo has no border artifacts)
  const marginTop = 0.02;

  const gold = new THREE.Color(0xc9a24b);
  const goldLight = new THREE.Color(0xf3e0a6);
  const ember = new THREE.Color(0x5c3a14); // darker/richer bronze — hair, glasses,
                                            // shadow read as a distinct tone (contrast)

  // face and field are collected into SEPARATE arrays so they become two
  // independent objects. Only the face rotates; the field stays put — that is
  // what stops a rotated field-rectangle from leaving an empty corner.
  const faceHome = [];
  const faceCol = [];
  const faceSiz = [];

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (x < cw * marginX || x > cw * (1 - marginX)) continue;
      if (y < ch * marginTop) continue;
      const i = (y * cw + x) * 4;
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const bright = 0.299 * r + 0.587 * g + 0.114 * b;
      if (bright < threshold) continue;

      // posterize: smooth photographic brightness reads as a photo even in dots.
      // push contrast then snap to a handful of tone-bands so neighbouring
      // particles jump between visibly distinct shades (halftone/pointillist).
      let banded = (bright - 0.5) * 1.6 + 0.5;
      banded = Math.min(1, Math.max(0, banded));
      banded = Math.round(banded * 4) / 4; // 5 discrete bands: 0, .25, .5, .75, 1

      const wx = CENTER_X + (x - cw / 2) * scale;
      const wy = (ch / 2 - y) * scale + CENTER_Y;
      const wz = (Math.random() - 0.5) * 6; // depth shell -> 3D parallax on tilt
      faceHome.push(wx, wy, wz);

      let c;
      if (banded < 0.45) c = ember.clone().lerp(gold, banded / 0.45);
      else c = gold.clone().lerp(goldLight, (banded - 0.45) / 0.55);
      faceCol.push(c.r, c.g, c.b);
      faceSiz.push((0.07 + banded * 0.448) * (0.9 + Math.random() * 0.2));
    }
  }

  /* --- ambient field: a JITTERED GRID that fills the WHOLE hero section ---
     random scatter always leaves luck-of-the-draw gaps; a grid puts exactly one
     particle in every cell, so no cell can be empty -> guaranteed 100% coverage
     edge to edge. the per-cell jitter breaks up the grid so it reads organic,
     not checkerboard. */
  const vFOV = (camera.fov * Math.PI) / 180;
  const distZ = camera.position.z;
  const visH = 2 * Math.tan(vFOV / 2) * distZ;
  const visW = visH * (camera.aspect || 1.6);
  const fieldHome = [];
  const fieldCol = [];
  const fieldSiz = [];
  const fieldGold = new THREE.Color(0xc9a24b);
  const fieldEmber = new THREE.Color(0x5c3a14);
  const fieldLight = new THREE.Color(0xf3e0a6);

  const FIELD_MARGIN = 1.3;              // overscan past the visible frame
  const fw = visW * FIELD_MARGIN;
  const fh = visH * FIELD_MARGIN;
  const TARGET = 11000;                  // total dust particles
  const rows = Math.max(1, Math.round(Math.sqrt(TARGET * fh / fw)));
  const cols = Math.max(1, Math.round(TARGET / rows));
  const cellW = fw / cols;
  const cellH = fh / rows;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      // cell center + jitter up to ~half a cell in each direction (centered 0,0)
      const wx = -fw / 2 + (gx + 0.5 + (Math.random() - 0.5) * 0.95) * cellW;
      const wy = -fh / 2 + (gy + 0.5 + (Math.random() - 0.5) * 0.95) * cellH;
      const wz = (Math.random() - 0.5) * 4 - 1; // shallow depth (twinkle only)
      fieldHome.push(wx, wy, wz);

      const t = Math.random();
      let c;
      if (t < 0.15) c = fieldEmber.clone().lerp(fieldGold, t / 0.15);
      else if (t < 0.85) c = fieldGold.clone();
      else c = fieldGold.clone().lerp(fieldLight, (t - 0.85) / 0.15);
      fieldCol.push(c.r, c.g, c.b);

      // mostly small dust, occasional larger "bokeh" dot
      const big = Math.random() < 0.05;
      fieldSiz.push(big ? 0.2 + Math.random() * 0.4 : 0.03 + Math.random() * 0.15);
    }
  }

  /* --- shared material (same look for both objects) --- */
  const mat = new THREE.RawShaderMaterial({
    uniforms: {
      uScale: { value: (stage.clientHeight || 1) * SIZE_K_PER_HEIGHT },
      uPix: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uScale;
      uniform float uPix;
      attribute vec3 position;
      attribute vec3 color;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale * uPix / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.42, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.55;
        float a = core + halo;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  scaleMats.push(mat);

  function makeSystem(homelist, collist, sizlist) {
    const n = sizlist.length;
    const homeArr = new Float32Array(homelist);
    const pos = new Float32Array(homeArr);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(collist, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizlist, 1));
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    const seed = new Float32Array(n);
    for (let k = 0; k < n; k++) seed[k] = Math.random() * Math.PI * 2;
    return {
      points, count: n, home: homeArr, pos, seed,
      offX: new Float32Array(n), offY: new Float32Array(n),
      velX: new Float32Array(n), velY: new Float32Array(n),
      baseSize: new Float32Array(sizlist), sizeAttr: geo.attributes.size,
    };
  }

  const face = makeSystem(faceHome, faceCol, faceSiz);
  const field = makeSystem(fieldHome, fieldCol, fieldSiz);
  sys = { face, field };
}

/* ---------- physics + render (gabarito-tuned) ---------- */
const REPEL_R = 9.0;     // cursor force radius (world units) — big explosion reach
const REPEL_KICK = 1.3;  // push impulse -> how FAST particles fly out (lower = slower motion)
const SPRING = 0.005;    // pull-back to home -> lower = slower, floatier RETURN (lobod-like)
const DAMP = 0.96;       // velocity damping (friction while drifting)

// physics for one system (face or field). forceScale (0..1) comes from cursor
// speed: 0 = still/slow cursor (no push), 1 = fast sweep (full explosion).
function runPhysics(S, t, forceScale) {
  const { points, count, home, pos, seed, offX, offY, velX, velY, baseSize, sizeAttr } = S;
  const sizeArr = sizeAttr.array;

  let hasMouse = false;
  if (hasMouseWorld && forceScale > 0) {
    points.updateMatrixWorld();
    mouseLocal.copy(mouseWorld);
    points.worldToLocal(mouseLocal); // per-system: face is rotated, field is not
    hasMouse = true;
  }

  for (let k = 0; k < count; k++) {
    const j = k * 3;
    const s = seed[k];

    // base position = home + ambient procedural sway (no lag, direct — gabarito)
    const hx = home[j] + Math.sin(t * 0.3 + s) * 0.22;
    const hy = home[j + 1] + Math.cos(t * 0.25 + s * 1.3) * 0.22;
    const hz = home[j + 2] + Math.sin(t * 0.35 + s) * 0.5;

    // cursor repulsion feeds ONLY the XY offset (gabarito: no z-repel, no swirl)
    if (hasMouse) {
      const dx = hx + offX[k] - mouseLocal.x;
      const dy = hy + offY[k] - mouseLocal.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < REPEL_R * REPEL_R) {
        const d = Math.sqrt(d2) || 0.0001;
        const f = 1 - d / REPEL_R;
        const kick = f * f * REPEL_KICK * forceScale; // scaled by cursor speed
        velX[k] += (dx / d) * kick;
        velY[k] += (dy / d) * kick;
      }
    }

    // spring-back to zero offset + damping (weak spring = organic, slow settle)
    velX[k] += -offX[k] * SPRING;
    velY[k] += -offY[k] * SPRING;
    velX[k] *= DAMP;
    velY[k] *= DAMP;
    offX[k] += velX[k];
    offY[k] += velY[k];

    pos[j] = hx + offX[k];
    pos[j + 1] = hy + offY[k];
    pos[j + 2] = hz;

    // idle twinkle: gentle size pulse so the field never looks fully static
    sizeArr[k] = baseSize[k] * (0.85 + Math.sin(t * 1.4 + s * 2.1) * 0.15);
  }
  points.geometry.attributes.position.needsUpdate = true;
  sizeAttr.needsUpdate = true;
}

function step(dt, t) {
  mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * 0.05;
  mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * 0.05;

  // --- cursor world position + speed (computed ONCE per frame) ---
  hasMouseWorld = false;
  if (mouseActive) {
    ndc.set(mouseTarget.x, mouseTarget.y);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(plane, mouseWorld)) {
      hasMouseWorld = true;
      const sp = prevMouseValid ? mouseWorld.distanceTo(prevMouseWorld) : 0;
      prevMouseWorld.copy(mouseWorld);
      prevMouseValid = true;
      mouseSpeedSmooth += (sp - mouseSpeedSmooth) * 0.35;
    }
  } else {
    prevMouseValid = false;
    mouseSpeedSmooth += (0 - mouseSpeedSmooth) * 0.35;
  }
  forceScale = Math.min(
    1,
    Math.max(0, (mouseSpeedSmooth - SPEED_DEAD) / (SPEED_FULL - SPEED_DEAD))
  );

  if (sys) {
    // ONLY the face rotates. The field is a separate object that never rotates,
    // so a tilted field-rectangle can no longer leave an empty corner.
    const tgtRotY = mouseSmooth.x * 0.45;
    const tgtRotX = -mouseSmooth.y * 0.28;
    const fp = sys.face.points;
    fp.rotation.y += (tgtRotY - fp.rotation.y) * 0.05;
    fp.rotation.x += (tgtRotX - fp.rotation.x) * 0.05;

    runPhysics(sys.face, t, forceScale);
    runPhysics(sys.field, t, forceScale);
  }

  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  step(dt, clock.elapsedTime);
}
animate();

/* ---------- test hooks (hidden automation tab has no rAF) ---------- */
window.__render = () => renderer.render(scene, camera);
window.__step = (frames, mx, my, active) => {
  if (mx !== undefined) {
    mouseTarget.set(mx, my);
    mouseActive = !!active;
  }
  const n = frames || 1;
  for (let i = 0; i < n; i++) step(0.016, clock.elapsedTime + i * 0.016);
};
window.__probe = () => {
  if (!sys) return "sys:null";
  const a = sys.field.pos;
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (let i = 0; i < a.length; i += 3) {
    mnx = Math.min(mnx, a[i]); mxx = Math.max(mxx, a[i]);
    mny = Math.min(mny, a[i + 1]); mxy = Math.max(mxy, a[i + 1]);
  }
  return `face=${sys.face.count} field=${sys.field.count} fieldRotY=${sys.field.points.rotation.y.toFixed(3)} faceRotY=${sys.face.points.rotation.y.toFixed(3)}`;
};

/* ---------- load portrait ---------- */
const img = new Image();
img.crossOrigin = "anonymous";
img.onload = () => build(img);
img.onerror = () => {
  stage.insertAdjacentHTML(
    "beforeend",
    '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8a94a3;font:12px/1.5 Inter,sans-serif;text-align:center;padding:24px">Coloque a foto em <b style="color:#c9a24b">&nbsp;public/daniel.jpg</b><br>e recarregue.</div>'
  );
};
img.src = IMAGE_SRC;

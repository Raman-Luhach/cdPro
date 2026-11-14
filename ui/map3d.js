/* =====================================================================
 * Cinematic 3D journey view (Three.js r147, vendored in /vendor/three)
 * - the same station coordinates as the 2D map, lifted into 3D
 * - lines are glowing elevated tubes, stations are platforms on pillars
 * - a 3-coach train runs along the compiled route; the camera follows
 *   it in cinematic / chase / aerial / free mode
 * Three.js is loaded lazily the first time the 3D view is opened.
 * ===================================================================== */
(function (root) {
  'use strict';

  var LIBS = ['three.min.js', 'CopyShader.js', 'LuminosityHighPassShader.js', 'EffectComposer.js',
    'RenderPass.js', 'ShaderPass.js', 'UnrealBloomPass.js', 'OrbitControls.js', 'CSS2DRenderer.js'];
  var loading = null;

  /** load the vendored three.js scripts one after another (classic scripts work from file://) */
  function loadThree() {
    if (root.THREE && root.THREE.CSS2DRenderer) return Promise.resolve();
    if (loading) return loading;
    loading = LIBS.reduce(function (p, f) {
      return p.then(function () {
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = 'vendor/three/' + f; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + f)); };
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
    loading.catch(function () { loading = null; });
    return loading;
  }

  var YAMUNA = [[77.236, 28.76], [77.232, 28.72], [77.238, 28.69], [77.248, 28.665], [77.258, 28.64], [77.262, 28.615],
    [77.272, 28.595], [77.282, 28.575], [77.296, 28.55], [77.312, 28.52], [77.322, 28.49], [77.33, 28.45], [77.345, 28.40], [77.36, 28.34]];

  var TRACK_Y = 1.6, TRAIN_SCALE = 1.35;     // height of the elevated track
  var SCALE = 0.1;       // SVG units -> world units

  var THEMES = {
    light: { bg: 0xdfe7f2, fog: 0xdfe7f2, ground: 0xc9d2df, grid1: 0xaeb9ca, grid2: 0xbcc6d5, river: 0x5fa8e6, pillar: 0x9aa5b8,
      station: 0xffffff, hemiSky: 0xffffff, hemiGround: 0x8b96a8, hemi: 0.7, sun: 0.55, bloom: 0, threshold: 1, radius: 0.4, emissive: 0.3, dim: 0.22 },
    dark: { bg: 0x060a12, fog: 0x060a12, ground: 0x0b111c, grid1: 0x1b2535, grid2: 0x121a27, river: 0x1d5f99, pillar: 0x2a3446,
      station: 0xdfe7f5, hemiSky: 0x8fa6d6, hemiGround: 0x0b111c, hemi: 0.45, sun: 0.35, bloom: 1.1, threshold: 0.12, radius: 0.55, emissive: 0.6, dim: 0.16 }
  };

  function Map3D(box, net, opts) {
    this.box = box; this.net = net; this.opts = opts || {};
    this.speed = 2; this.playing = false; this.progress = 0; this.lastIdx = -1;
    this.cameraMode = 'cinematic'; this.glow = true; this.showAll = false; this.hidden = {};
    this.visible = false; this.journey = null;
  }

  Map3D.load = loadThree;

  Map3D.prototype.init = function () {
    var THREE = root.THREE, self = this, net = this.net;
    this.T = THREE;
    var w = this.box.clientWidth || 800, h = this.box.clientHeight || 500;

    var r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setSize(w, h);
    this.box.appendChild(r.domElement);

    this.labelRenderer = new THREE.CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    var ld = this.labelRenderer.domElement;
    ld.style.position = 'absolute'; ld.style.inset = '0'; ld.style.pointerEvents = 'none';
    this.box.appendChild(ld);

    var scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.5, 2000);

    // centre of the network
    var xs = [], zs = [];
    Object.keys(net.stations).forEach(function (s) { xs.push(net.stations[s].x); zs.push(net.stations[s].y); });
    this.cx = (Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2;
    this.cz = (Math.min.apply(0, zs) + Math.max.apply(0, zs)) / 2;
    this.span = Math.max(Math.max.apply(0, xs) - Math.min.apply(0, xs), Math.max.apply(0, zs) - Math.min.apply(0, zs)) * SCALE;

    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.9); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.7); this.sun.position.set(-40, 80, 30); scene.add(this.sun);

    // ground, grid, river
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2; scene.add(this.ground);
    this.gridGroup = new THREE.Group(); scene.add(this.gridGroup);
    var riverPts = YAMUNA.map(function (p) { var q = net.project(p[0], p[1]); return self.v(q.x, q.y, 0.05); });
    var riverCurve = new THREE.CatmullRomCurve3(riverPts, false, 'centripetal');
    this.riverMat = new THREE.MeshStandardMaterial({ color: 0x8ec5f0, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.75 });
    var river = new THREE.Mesh(new THREE.TubeGeometry(riverCurve, 160, 1.3, 8, false), this.riverMat);
    river.scale.y = 0.04; scene.add(river);

    // lines (elevated glowing tubes) + pillars
    this.lineMeshes = {};
    this.pillarMat = new THREE.MeshStandardMaterial({ color: 0xc9d0dc, roughness: 0.8 });
    var pillarGeo = new THREE.CylinderGeometry(0.12, 0.16, TRACK_Y, 6);
    var pillars = new THREE.Group(); scene.add(pillars);
    net.lines.forEach(function (line) {
      self.lineMeshes[line.id] = [];
      line.routes.forEach(function (rt) {
        var pts = rt.stations.map(function (s) { var st = net.stations[s]; return self.v(st.x, st.y, TRACK_Y); });
        var curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        var mat = new THREE.MeshStandardMaterial({ color: line.colour, emissive: line.colour, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.2, transparent: true, opacity: 1 });
        var mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, rt.stations.length * 10, 0.42, 10, false), mat);
        scene.add(mesh); self.lineMeshes[line.id].push(mesh);
      });
    });
    Object.keys(net.stations).forEach(function (s) {
      var st = net.stations[s], p = new THREE.Mesh(pillarGeo, self.pillarMat);
      p.position.copy(self.v(st.x, st.y, TRACK_Y / 2)); pillars.add(p);
    });

    // stations
    this.stationMeshes = {};
    this.stationMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.3 });
    var stGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 18), ixGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.6, 24), ringGeo = new THREE.TorusGeometry(1.25, 0.11, 8, 32);
    Object.keys(net.stations).forEach(function (s) {
      var st = net.stations[s], g = new THREE.Group();
      g.position.copy(self.v(st.x, st.y, TRACK_Y));
      var m = new THREE.Mesh(st.isInterchange ? ixGeo : stGeo, self.stationMat); g.add(m);
      if (st.isInterchange) { var ring = new THREE.Mesh(ringGeo, self.ringMat); ring.rotation.x = Math.PI / 2; g.add(ring); }
      scene.add(g);
      self.stationMeshes[s] = { group: g, mesh: m };
    });

    // labels (created lazily)
    this.labels = {};

    // journey layer + train
    this.journeyGroup = new THREE.Group(); scene.add(this.journeyGroup);
    this.train = this._makeTrain();
    this.train.visible = false;
    scene.add(this.train);

    // post-processing (bloom)
    this.composer = new THREE.EffectComposer(r);
    this.composer.addPass(new THREE.RenderPass(scene, this.camera));
    this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.55, 0.18);
    this.composer.addPass(this.bloom);

    // controls (free camera)
    this.controls = new THREE.OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.48; this.controls.minDistance = 4; this.controls.maxDistance = 260;
    this.controls.enabled = false;
    r.domElement.addEventListener('pointerdown', function () {
      // grabbing the scene switches to free camera
      if (self.cameraMode !== 'free' && self.opts.onCameraTakeover) self.opts.onCameraTakeover();
    });

    this.camPos = new THREE.Vector3(0, this.span * 1.1, this.span * 0.9);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);

    this.applyTheme();
    new MutationObserver(function () { self.applyTheme(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(this.box);

    this.clock = new THREE.Clock();
    this.t0 = performance.now();
    (function loop() {
      self.raf = requestAnimationFrame(loop);
      if (self.visible) self._frame();
    })();
    this._refreshLabels();
  };

  /** SVG (x,y) -> world vector */
  Map3D.prototype.v = function (x, y, h) {
    return new this.T.Vector3((x - this.cx) * SCALE, h, (y - this.cz) * SCALE);
  };

  Map3D.prototype._makeTrain = function () {
    var THREE = this.T, train = new THREE.Group();
    this.carStripeMats = [];
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.35, metalness: 0.35 });
    var winMat = new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.2, metalness: 0.6, emissive: 0x88b4ff, emissiveIntensity: 0.25 });
    this.cars = [];
    for (var i = 0; i < 3; i++) {
      var car = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 0.72), bodyMat); body.position.y = 0.42; car.add(body);
      var stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2b705, emissive: 0xf2b705, emissiveIntensity: 0.8 });
      this.carStripeMats.push(stripeMat);
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.1, 0.74), stripeMat); stripe.position.y = 0.3; car.add(stripe);
      var win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.745), winMat); win.position.y = 0.56; car.add(win);
      var roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.6), bodyMat); roof.position.y = 0.77; car.add(roof);
      if (i === 0) {
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
        lamp.position.set(0.97, 0.38, 0.2); car.add(lamp);
        var lamp2 = lamp.clone(); lamp2.position.z = -0.2; car.add(lamp2);
        this.headlight = new THREE.PointLight(0xfff1c0, 1.2, 9); this.headlight.position.set(1.6, 0.6, 0); car.add(this.headlight);
      }
      train.add(car); this.cars.push(car);
    }
    // glow halo under the train
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.2, 1.6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    this.halo.rotation.x = -Math.PI / 2; train.add(this.halo);
    this.cars.forEach(function (c) { c.scale.setScalar(TRAIN_SCALE); });
    return train;
  };

  Map3D.prototype.applyTheme = function () {
    if (!this.scene) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark', th = THEMES[dark ? 'dark' : 'light'], THREE = this.T, self = this;
    this.theme = th;
    this.scene.background = new THREE.Color(th.bg);
    this.scene.fog = new THREE.Fog(th.fog, this.span * 0.9, this.span * 3.2);
    this.ground.material.color.set(th.ground);
    this.riverMat.color.set(th.river);
    this.pillarMat.color.set(th.pillar);
    this.stationMat.color.set(th.station);
    this.hemi.color.set(th.hemiSky); this.hemi.groundColor.set(th.hemiGround); this.hemi.intensity = th.hemi;
    this.sun.intensity = th.sun;
    this.headlight.intensity = dark ? 2 : 0.8;
    this.gridGroup.clear();
    var grid = new THREE.GridHelper(400, 80, th.grid1, th.grid2); grid.position.y = 0.01; this.gridGroup.add(grid);
    this.bloom.strength = this.glow ? th.bloom : 0;
    this.bloom.threshold = th.threshold; this.bloom.radius = th.radius;
    this._styleLines();
  };

  Map3D.prototype._styleLines = function () {
    var self = this, th = this.theme, inJ = this.journeyLines || null;
    Object.keys(this.lineMeshes).forEach(function (id) {
      self.lineMeshes[id].forEach(function (m) {
        m.visible = !self.hidden[id];
        m.material.opacity = inJ ? 0.18 + th.dim : 1;
        m.material.emissiveIntensity = inJ ? 0.05 : th.emissive;
      });
    });
  };

  Map3D.prototype.setGlow = function (on) { this.glow = on; if (this.bloom) this.bloom.strength = on ? this.theme.bloom : 0; };
  Map3D.prototype.toggleLine = function (id) { this.hidden[id] = !this.hidden[id]; if (this.scene) this._styleLines(); return !this.hidden[id]; };
  Map3D.prototype.setShowAll = function (v) { this.showAll = v; if (this.scene) this._refreshLabels(); };

  Map3D.prototype.setCameraMode = function (mode) {
    this.cameraMode = mode;
    if (!this.controls) return;
    this.controls.enabled = mode === 'free';
    if (mode === 'free') { this.controls.target.copy(this.camLook); this.controls.update(); }
  };

  Map3D.prototype.setVisible = function (v) {
    this.visible = v;
    if (v) { this.resize(); this.clock.getDelta(); }
    else this.pause();
  };

  Map3D.prototype.resize = function () {
    if (!this.renderer) return;
    var w = this.box.clientWidth, h = this.box.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h); this.labelRenderer.setSize(w, h); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };

  /* ---------------- labels ---------------- */
  Map3D.prototype._label = function (name) {
    if (this.labels[name]) return this.labels[name];
    var div = document.createElement('div');
    div.className = 'lbl3d' + (this.net.stations[name].isInterchange ? ' ix' : '');
    div.textContent = name;
    var obj = new this.T.CSS2DObject(div);
    obj.position.set(0, 1.25, 0);
    this.stationMeshes[name].group.add(obj);
    this.labels[name] = obj;
    return obj;
  };

  Map3D.prototype._refreshLabels = function () {
    var self = this, net = this.net, inJ = this.journeySet || {}, ends = {}, cur = this.currentStation;
    if (this.journey && this.journey.path.length) { ends[this.journey.path[0].station] = 1; ends[this.journey.path[this.journey.path.length - 1].station] = 1; }
    Object.keys(net.stations).forEach(function (s) {
      var ix = net.stations[s].isInterchange, show;
      if (self.showAll) show = true;
      else if (self.journey) show = ends[s] || s === cur || (inJ[s] && ix);   // keep long journeys readable
      else show = ix;
      if (show || self.labels[s]) {
        var l = self._label(s);
        l.visible = !!show;
        l.element.classList.toggle('journey', !!inJ[s]);
        l.element.classList.toggle('end', !!ends[s]);
        l.element.classList.toggle('current', s === cur && !ends[s]);
      }
    });
  };

  /* ---------------- journey ---------------- */
  Map3D.prototype.clearJourney = function () {
    this.pause();
    this.journey = null; this.journeySet = {}; this.journeyLines = null; this.currentStation = null;
    if (!this.scene) return;
    this.journeyGroup.clear();
    this.train.visible = false;
    this._styleLines(); this._refreshLabels();
    this.lastIdx = -1; this.progress = 0;
  };

  Map3D.prototype.showJourney = function (out) {
    this.clearJourney();
    if (!out || !out.path.length || !this.scene) { this.pendingJourney = out; return; }
    var THREE = this.T, self = this, net = this.net;
    this.journey = out; this.journeySet = {}; this.journeyLines = {};
    out.path.forEach(function (p) { self.journeySet[p.station] = 1; });
    out.summary.legs.forEach(function (l) { self.journeyLines[l.lineId] = 1; });
    this._styleLines();

    // bright route tubes per leg
    out.summary.legs.forEach(function (leg) {
      var pts = leg.stations.map(function (s) { var st = net.stations[s]; return self.v(st.x, st.y, TRACK_Y); });
      if (pts.length < 2) return;
      var curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      var mat = new THREE.MeshStandardMaterial({ color: leg.colour, emissive: leg.colour, emissiveIntensity: 0.9, roughness: 0.3 });
      self.journeyGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 14, 0.62, 12, false), mat));
    });
    // start / end beacons
    [[out.path[0], 0x16a34a], [out.path[out.path.length - 1], 0xdc2626]].forEach(function (b) {
      var st = net.stations[b[0].station];
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: b[1], transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.copy(self.v(st.x, st.y, TRACK_Y + 4.5)); self.journeyGroup.add(beam);
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), new THREE.MeshBasicMaterial({ color: b[1] }));
      orb.position.copy(self.v(st.x, st.y, TRACK_Y + 9.2)); self.journeyGroup.add(orb);
    });

    // one smooth curve through every station of the journey (the train's rail)
    var P = out.path;
    this.rail = P.length > 1 ? new THREE.CatmullRomCurve3(P.map(function (p) { return self.v(p.x, p.y, TRACK_Y + 0.35); }), false, 'centripetal') : null;
    this.railLengths = this.rail ? this.rail.getLengths(P.length * 24) : null;
    this._buildTimeline();
    this.train.visible = true;
    this.progress = 0; this.lastIdx = -1;
    this.introStart = performance.now();
    this._refreshLabels();
    this._place(0);
  };

  Map3D.prototype._buildTimeline = function () {
    var P = this.journey.path, marks = [0], t = 0;
    for (var i = 0; i + 1 < P.length; i++) { t += (i > 0 && P[i + 1].colour !== P[i].colour) ? 2.4 : 1; marks.push(t); }
    this.marks = marks; this.total = Math.max(t, 0.0001);
  };

  /** where the train is at timeline position t: returns rail parameter + state */
  Map3D.prototype._state = function (t) {
    var P = this.journey.path, m = this.marks, i = 0;
    while (i + 1 < m.length && m[i + 1] <= t) i++;
    var n = Math.max(P.length - 1, 1), k = 0, waiting = false;
    if (i + 1 < P.length) {
      var interval = m[i + 1] - m[i];
      var raw = t - m[i] - (interval - 1);
      waiting = raw < 0 && interval > 1;
      k = Math.max(0, Math.min(1, raw));
      k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    }
    var reached = (i + 1 < P.length && t >= m[i + 1] - 1e-6) ? i + 1 : i;
    return { u: Math.min(1, (i + k) / n), i: i, k: k, reached: reached, waiting: waiting, colour: P[Math.min(i + 1, P.length - 1)].colour };
  };

  Map3D.prototype._place = function (t) {
    if (!this.journey) return;
    var THREE = this.T, s = this._state(t), P = this.journey.path, self = this;
    this.state = s;
    if (this.rail) {
      // place coaches by true distance along the rail so they stay coupled on sharp curves
      var L = this.railLengths, div = L.length - 1, total = L[div];
      var ti = s.u * div, i0 = Math.floor(ti), f = ti - i0;
      var headDist = L[Math.min(i0, div)] + (L[Math.min(i0 + 1, div)] - L[Math.min(i0, div)]) * f;
      var carLen = 2.05 * TRAIN_SCALE;
      this.cars.forEach(function (car, ci) {
        var a = Math.max(0, Math.min(1, (headDist - ci * carLen) / total));
        var pos = self.rail.getPointAt(a), tan = self.rail.getTangentAt(a);
        car.position.copy(pos);
        car.rotation.set(0, Math.atan2(-tan.z, tan.x), 0);
      });
    } else {
      var st = this.net.stations[P[0].station];
      this.cars.forEach(function (car, ci) { car.position.copy(self.v(st.x, st.y, TRACK_Y + 0.12)); car.position.x -= ci * 2; });
    }
    this.halo.position.copy(this.cars[0].position); this.halo.position.y -= 0.02;
    this.halo.material.color.set(s.colour);
    this.carStripeMats.forEach(function (m) { m.color.set(s.colour); m.emissive.set(s.colour); });
    if (s.reached !== this.lastIdx) {
      this.lastIdx = s.reached;
      this._pulseStation(P[s.reached].station, P[s.reached].colour);
      this.currentStation = P[s.reached].station; this._refreshLabels();
      if (this.opts.onStation) this.opts.onStation(s.reached, P[s.reached], P);
    }
    if (this.opts.onProgress) this.opts.onProgress(t / this.total, P[s.reached]);
  };

  Map3D.prototype._pulseStation = function (name, colour) {
    var THREE = this.T, sm = this.stationMeshes[name]; if (!sm) return;
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 32), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(sm.group.position); ring.position.y += 0.2;
    ring.userData.born = performance.now();
    this.journeyGroup.add(ring);
    (this.pulses = this.pulses || []).push(ring);
  };

  /* ---------------- playback ---------------- */
  Map3D.prototype.play = function () {
    if (!this.journey || this.journey.path.length < 2) return;
    if (this.progress >= this.total) this.progress = 0;
    this.playing = true; this.clock.getDelta();
    if (this.opts.onPlayState) this.opts.onPlayState(true);
  };
  Map3D.prototype.pause = function () { if (this.playing && this.opts.onPlayState) this.opts.onPlayState(false); this.playing = false; };
  Map3D.prototype.replay = function () {
    this.pause(); this.progress = 0; this.lastIdx = -1;
    if (this.journey) { this.introStart = performance.now(); this._place(0); this.play(); }
  };

  /* ---------------- per-frame ---------------- */
  Map3D.prototype._frame = function () {
    var THREE = this.T, dt = Math.min(this.clock.getDelta(), 0.1), now = performance.now(), self = this;

    if (this.playing && this.journey) {
      // slower than 2D: a hop takes ~1.1 s at 1x so the camera can breathe
      this.progress = Math.min(this.total, this.progress + dt * 0.9 * this.speed);
      this._place(this.progress);
      if (this.progress >= this.total) { this.playing = false; this.finishedAt = now; if (this.opts.onPlayState) this.opts.onPlayState(false, true); }
    }

    // station pulse rings
    if (this.pulses) this.pulses = this.pulses.filter(function (r) {
      var a = (now - r.userData.born) / 900;
      if (a >= 1) { self.journeyGroup.remove(r); r.geometry.dispose(); r.material.dispose(); return false; }
      r.scale.setScalar(1 + a * 3); r.material.opacity = 0.9 * (1 - a); return true;
    });
    // pulsing halo under the train
    this.halo.material.opacity = (this.theme.bloom > 0 ? 0.25 : 0.14) + 0.1 * Math.sin(now * 0.006);

    this._updateCamera(dt, now);
    if (this.cameraMode === 'free') this.controls.update();
    if (this.glow && this.theme.bloom > 0) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  Map3D.prototype._updateCamera = function (dt, now) {
    if (this.cameraMode === 'free') return;
    var THREE = this.T, pos = new THREE.Vector3(), look = new THREE.Vector3(), lerp = 1 - Math.exp(-dt * 2.2);
    var hasTrain = this.journey && this.rail;
    var mode = this.cameraMode;

    if (!this.journey) {
      // idle: slow orbit over the whole network
      var a = now * 0.00006;
      pos.set(Math.sin(a) * this.span * 0.75, this.span * 0.75, Math.cos(a) * this.span * 0.75);
      look.set(0, 0, 0); lerp = 1 - Math.exp(-dt * 1.2);
    } else {
      var head = this.cars[0].position, s = this.state || { u: 0 };
      var tan = hasTrain ? this.rail.getTangent(s.u) : new THREE.Vector3(1, 0, 0);
      tan.y = 0; tan.normalize();
      var side = new THREE.Vector3(-tan.z, 0, tan.x);
      var sinceIntro = (now - (this.introStart || 0)) / 1000;
      var finished = this.progress >= this.total && this.journey.path.length > 1;

      if (mode === 'aerial') {
        pos.copy(head).add(new THREE.Vector3(0, 30, 22)); look.copy(head);
      } else if (mode === 'chase') {
        pos.copy(head).addScaledVector(tan, -11).add(new THREE.Vector3(0, 5.5, 0)).addScaledVector(side, 2);
        look.copy(head).addScaledVector(tan, 6);
      } else { // cinematic director
        if (finished) {
          // pull back to show the whole route
          var b = this._routeBox();
          pos.set(b.c.x + b.r * 0.35, b.r * 1.15 + 10, b.c.z + b.r * 0.95); look.copy(b.c);
          lerp = 1 - Math.exp(-dt * 1.1);
        } else if (!this.playing && this.progress === 0) {
          var b2 = this._routeBox();
          pos.set(b2.c.x, b2.r * 1.1 + 12, b2.c.z + b2.r * 0.9); look.copy(b2.c);
        } else if (sinceIntro < 2.2) {
          // swoop in from above
          pos.copy(head).add(new THREE.Vector3(0, 26, 18)).addScaledVector(tan, -6); look.copy(head);
          lerp = 1 - Math.exp(-dt * 1.6);
        } else if (s.waiting) {
          // orbit the interchange while changing lines
          var ang = now * 0.0009;
          pos.copy(head).add(new THREE.Vector3(Math.cos(ang) * 9, 6.5, Math.sin(ang) * 9)); look.copy(head);
          lerp = 1 - Math.exp(-dt * 1.8);
        } else {
          // alternate between a low chase and a side tracking shot every few stations
          var shot = Math.floor((s.i || 0) / 5) % 3;
          if (shot === 1) { pos.copy(head).addScaledVector(side, 9).add(new THREE.Vector3(0, 3, 0)).addScaledVector(tan, 2); look.copy(head).addScaledVector(tan, 2); }
          else if (shot === 2) { pos.copy(head).addScaledVector(tan, -5).add(new THREE.Vector3(0, 13, 0)).addScaledVector(side, -6); look.copy(head).addScaledVector(tan, 5); }
          else { pos.copy(head).addScaledVector(tan, -10).add(new THREE.Vector3(0, 5, 0)).addScaledVector(side, 1.8); look.copy(head).addScaledVector(tan, 6); }
        }
      }
    }
    this.camPos.lerp(pos, lerp); this.camLook.lerp(look, Math.min(1, lerp * 1.4));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
  };

  Map3D.prototype._routeBox = function () {
    var THREE = this.T, self = this, box = new THREE.Box3();
    this.journey.path.forEach(function (p) { box.expandByPoint(self.v(p.x, p.y, TRACK_Y)); });
    var c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    return { c: c, r: Math.max(sz.x, sz.z, 12) };
  };

  root.Map3D = Map3D;
})(window);

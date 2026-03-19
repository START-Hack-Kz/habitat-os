import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { BackendCropZone, BackendMissionState, GreenhouseSummary, StatusTone } from "../types";

interface LandingSceneOptions {
  greenhouses: GreenhouseSummary[];
  onSelect: (greenhouseId: string) => void;
}

interface LandingSceneController {
  dispose: () => void;
}

interface HabitatInstance {
  id: string;
  summary: GreenhouseSummary;
  root: THREE.Group;
  shell: THREE.Mesh;
  frame: THREE.LineSegments;
  ring: THREE.Mesh;
  label: HTMLElement;
  baseY: number;
  baseRotationY: number;
  hoverMix: number;
  pulseOffset: number;
}

interface GreenhouseHoverSnapshot {
  greenhouseId: string;
  greenhouseName: string;
  greenhouseCode: string;
  plantCount: number;
  zoneId: string;
  cropLabel: string;
  healthLabel: string;
  healthTone: StatusTone;
  stateLabel: string;
  stateTone: StatusTone;
  growthDay: number;
  growthCycleDays: number;
  growthProgressPercent: number;
  projectedYieldKg: number;
  allocationPercent: number;
  summary: string;
  metrics: Array<{ label: string; value: string; tone: StatusTone }>;
}

interface HabitatPlacement {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

type HabitatBuilder = (tone: THREE.ColorRepresentation) => {
  shellGeometry: THREE.BufferGeometry;
  shellScale?: [number, number, number];
  shellPosition?: [number, number, number];
  frameExtras?: THREE.Object3D[];
  garden?: THREE.Object3D;
  platformScale?: [number, number, number];
  corePosition?: [number, number, number];
  ringScale?: [number, number, number];
  bermScale?: [number, number, number];
  canopyScale?: [number, number, number];
  canopyPosition?: [number, number, number];
};

export function renderGreenhouseLanding(
  greenhouses: GreenhouseSummary[],
  missionDay: number | null,
  mission: BackendMissionState | null,
): string {
  const hoverSnapshots = buildGreenhouseHoverSnapshots(greenhouses, mission);

  return `
    <section class="landing-scene" aria-label="Greenhouse selection">
      <div class="landing-scene__hud">
        <span class="landing-scene__label mono">AETHER Habitat Array</span>
        <span class="landing-scene__sol mono">SOL ${String(missionDay ?? 0).padStart(3, "0")}</span>
      </div>
      <div class="landing-scene__viewport" data-landing-viewport="true" aria-hidden="true"></div>
      <div class="landing-scene__labels" data-landing-labels="true">
        ${hoverSnapshots
          .map(
            (snapshot) => `
              <div class="landing-tag landing-tag--${snapshot.healthTone.toLowerCase()}" data-greenhouse-label="${escapeHtml(snapshot.greenhouseId)}">
                <span class="landing-tag__code mono">${escapeHtml(snapshot.greenhouseCode)}</span>
                <span class="landing-tag__name">${escapeHtml(snapshot.greenhouseName)}</span>
                <span class="landing-tag__signal mono">${escapeHtml(snapshot.cropLabel)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="landing-scene__hovercards" data-landing-hovercards="true">
        ${hoverSnapshots
          .map(
            (snapshot) => `
              <article
                class="landing-zone-card landing-zone-card--${snapshot.healthTone.toLowerCase()}"
                data-greenhouse-hovercard="${escapeHtml(snapshot.greenhouseId)}"
              >
                <div class="landing-zone-card__topline">
                  <span class="landing-zone-card__zone mono">${escapeHtml(snapshot.zoneId)}</span>
                  <span class="landing-zone-card__badges">
                    ${renderLandingBadge(snapshot.healthLabel, snapshot.healthTone)}
                    ${renderLandingBadge(snapshot.stateLabel, snapshot.stateTone)}
                  </span>
                </div>
                <div class="landing-zone-card__titleblock">
                  <h2 class="landing-zone-card__title">${escapeHtml(snapshot.greenhouseName)}</h2>
                  <p class="landing-zone-card__subtitle">${escapeHtml(snapshot.cropLabel)} · ${snapshot.plantCount} plants</p>
                </div>
                <div class="landing-zone-card__metrics">
                  <div class="landing-zone-card__metric">
                    <span class="landing-zone-card__metric-label mono">Cycle</span>
                    <span class="landing-zone-card__metric-value mono">${snapshot.growthDay}/${snapshot.growthCycleDays} d</span>
                  </div>
                  <div class="landing-zone-card__metric">
                    <span class="landing-zone-card__metric-label mono">Progress</span>
                    <span class="landing-zone-card__metric-value mono">${snapshot.growthProgressPercent}%</span>
                  </div>
                  <div class="landing-zone-card__metric">
                    <span class="landing-zone-card__metric-label mono">Projected Yield</span>
                    <span class="landing-zone-card__metric-value mono">${snapshot.projectedYieldKg.toFixed(1)} kg</span>
                  </div>
                  <div class="landing-zone-card__metric">
                    <span class="landing-zone-card__metric-label mono">Allocation</span>
                    <span class="landing-zone-card__metric-value mono">${snapshot.allocationPercent}%</span>
                  </div>
                </div>
                <div class="landing-zone-card__progress">
                  <span style="width:${snapshot.growthProgressPercent}%;"></span>
                </div>
                <p class="landing-zone-card__summary">${escapeHtml(snapshot.summary)}</p>
                <div class="landing-zone-card__sensor-grid">
                  ${snapshot.metrics
                    .map(
                      (metric) => `
                        <div class="landing-zone-card__sensor">
                          <span class="landing-zone-card__sensor-label mono">${escapeHtml(metric.label)}</span>
                          <span class="landing-zone-card__sensor-state mono">[ ${escapeHtml(renderStatusWord(metric.tone))} ]</span>
                          <span class="landing-zone-card__sensor-value mono">${escapeHtml(metric.value)}</span>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function mountGreenhouseLanding(
  root: HTMLElement,
  options: LandingSceneOptions,
): LandingSceneController {
  const viewport = root.querySelector<HTMLElement>("[data-landing-viewport]");
  const labelHost = root.querySelector<HTMLElement>("[data-landing-labels]");
  const hovercardHost = root.querySelector<HTMLElement>("[data-landing-hovercards]");

  if (!viewport || !labelHost || !hovercardHost) {
    return { dispose: () => undefined };
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x04060b, 1);
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a100d, 0.021);

  const camera = new THREE.PerspectiveCamera(
    38,
    Math.max(viewport.clientWidth, 1) / Math.max(viewport.clientHeight, 1),
    0.1,
    140,
  );
  camera.position.set(2.2, 7.4, 22.6);
  camera.lookAt(1.4, 0.35, -4.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 12;
  controls.maxDistance = 36;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.target.set(1.4, 0.3, -4.6);

  const ambient = new THREE.AmbientLight(0xe4d6ca, 0.42);
  const hemisphere = new THREE.HemisphereLight(0xb59d8a, 0x5a2d20, 0.88);
  const key = new THREE.DirectionalLight(0xc8b4a1, 1.08);
  key.position.set(6, 8, 5);
  const rim = new THREE.DirectionalLight(0xc16f4e, 0.72);
  rim.position.set(-7, 3, -8);
  const sunLight = new THREE.DirectionalLight(0xf2b27a, 1.08);
  sunLight.position.set(-10, 7, -11);
  const marsGlow = new THREE.PointLight(0xb45737, 1.2, 52, 2);
  marsGlow.position.set(0.8, 1.6, -18.4);
  scene.add(ambient, hemisphere, key, rim, sunLight, marsGlow);

  scene.add(createTerrain());
  scene.add(createRockField());
  scene.add(createDustHaze());
  scene.add(createSunDisc());
  scene.add(createMountainRange());
  scene.add(createHorizonGlow());
  scene.add(createAtmosphereArc());
  scene.add(createDustField());
  scene.add(createHumanOutpost());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const interactiveMeshes: THREE.Object3D[] = [];
  const labelMap = new Map<string, HTMLElement>();
  const hovercardMap = new Map<string, HTMLElement>();
  const habitats: HabitatInstance[] = [];

  labelHost.querySelectorAll<HTMLElement>("[data-greenhouse-label]").forEach((label) => {
    const id = label.dataset.greenhouseLabel ?? "";
    if (id) {
      labelMap.set(id, label);
    }
  });

  hovercardHost.querySelectorAll<HTMLElement>("[data-greenhouse-hovercard]").forEach((card) => {
    const id = card.dataset.greenhouseHovercard ?? "";
    if (id) {
      hovercardMap.set(id, card);
    }
  });

  const habitatPlacements: HabitatPlacement[] = [
    { x: -5.4, z: 2.7, y: 0.28, rotY: -0.18 },
    { x: 1.65, z: 2.0, y: 0.32, rotY: 0.14 },
    { x: -2.3, z: -3.6, y: 0.28, rotY: -0.04 },
    { x: 5.9, z: -2.9, y: 0.32, rotY: 0.24 },
  ];

  scene.add(createHabitatWalkwayNetwork(habitatPlacements));

  options.greenhouses.forEach((greenhouse, index) => {
    const label = labelMap.get(greenhouse.id);
    if (!label) {
      return;
    }

    const habitat = createHabitat(greenhouse, label);
    const placement = habitatPlacements[index] ?? habitatPlacements[0];
    habitat.root.position.set(placement.x, placement.y, placement.z);
    habitat.baseY = placement.y;
    habitat.baseRotationY = placement.rotY;
    habitat.root.rotation.y = placement.rotY;
    habitats.push(habitat);
    scene.add(habitat.root);
    interactiveMeshes.push(habitat.shell, habitat.frame, habitat.ring);
  });

  let hoveredId = "";
  let disposed = false;
  let selectionTimer = 0;

  const onPointerMove = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    hoveredId = pickHoveredId();
  };

  const onPointerLeave = () => {
    hoveredId = "";
  };

  const onClick = () => {
    const selected = hoveredId;
    if (!selected) {
      return;
    }

    if (selectionTimer) {
      window.clearTimeout(selectionTimer);
    }

    selectionTimer = window.setTimeout(() => {
      options.onSelect(selected);
    }, 150);
  };

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("click", onClick);

  const resizeObserver = new ResizeObserver(() => {
    if (disposed) {
      return;
    }

    const width = Math.max(viewport.clientWidth, 1);
    const height = Math.max(viewport.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  });

  resizeObserver.observe(viewport);

  renderer.setAnimationLoop(() => {
    const elapsed = clock.getElapsedTime();

    habitats.forEach((habitat, index) => {
      const isHovered = habitat.id === hoveredId;
      habitat.hoverMix = THREE.MathUtils.damp(habitat.hoverMix, isHovered ? 1 : 0, 4.8, 1 / 60);

      habitat.root.position.y = habitat.baseY + habitat.hoverMix * 0.32;
      habitat.root.rotation.y =
        habitat.baseRotationY + Math.sin(elapsed * 0.2 + index * 0.7) * 0.06 + habitat.hoverMix * 0.08;
      habitat.root.rotation.x = 0.02 + habitat.hoverMix * 0.04;

      const shellMaterial = habitat.shell.material as THREE.MeshStandardMaterial;
      shellMaterial.opacity = 0.08 + habitat.hoverMix * 0.07 + (Math.sin(elapsed * 1.4 + habitat.pulseOffset) + 1) * 0.008;
      shellMaterial.emissiveIntensity = 0.18 + habitat.hoverMix * 0.42;

      const frameMaterial = habitat.frame.material as THREE.LineBasicMaterial;
      frameMaterial.opacity = 0.48 + habitat.hoverMix * 0.44;

      const ringMaterial = habitat.ring.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = 0.12 + habitat.hoverMix * 0.4;
      habitat.ring.scale.setScalar(1 + habitat.hoverMix * 0.12 + Math.sin(elapsed * 0.9 + habitat.pulseOffset) * 0.01);
      habitat.ring.rotation.z += 0.004 + habitat.hoverMix * 0.006;

      habitat.label.classList.toggle("is-hovered", isHovered);
      hovercardMap.get(habitat.id)?.classList.toggle("is-active", isHovered);
    });

    controls.update();
    updateLabelPositions();
    renderer.render(scene, camera);
  });

  return {
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      if (selectionTimer) {
        window.clearTimeout(selectionTimer);
      }
      resizeObserver.disconnect();
      controls.dispose();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("click", onClick);
      habitats.forEach(disposeHabitat);
      disposeObject(scene);
      renderer.dispose();
      viewport.innerHTML = "";
    },
  };

  function pickHoveredId(): string {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactiveMeshes, false)[0];
    if (!hit) {
      return "";
    }

    const target = hit.object.userData.greenhouseId as string | undefined;
    return target ?? "";
  }

  function updateLabelPositions(): void {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;

    habitats.forEach((habitat) => {
      const projected = habitat.root.position.clone().add(new THREE.Vector3(0, 2.15, 0));
      projected.project(camera);

      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const visible = projected.z <= 1.1;

      habitat.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      habitat.label.style.opacity = visible ? "1" : "0";
    });
  }
}

function createTerrain(): THREE.Object3D {
  const geometry = new THREE.PlaneGeometry(78, 56, 132, 98);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const habitatBasins = [
    new THREE.Vector2(-2.6, 1.8),
    new THREE.Vector2(2.85, 0.85),
    new THREE.Vector2(-0.6, -2.55),
    new THREE.Vector2(4.9, -2.1),
  ];

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const ridge = Math.sin(x * 0.06) * 0.1 + Math.cos(y * 0.05) * 0.08;
    const basin = Math.cos(y * 0.08) * 0.08;
    const ripple =
      Math.sin((x + y) * 0.1) * 0.03 +
      Math.cos((x - y) * 0.08) * 0.025 +
      Math.sin(y * 0.24 + x * 0.04) * 0.018;
    const crater =
      Math.exp(-((x - 12.5) ** 2 + (y + 9.4) ** 2) * 0.0052) * -0.07 +
      Math.exp(-((x + 15.6) ** 2 + (y - 10.4) ** 2) * 0.0048) * -0.05;
    const excavation = habitatBasins.reduce((sum, basinCenter) => {
      const dx = x - basinCenter.x;
      const dy = y - basinCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const bowl = Math.exp(-(dist * dist) * 0.92) * -0.16;
      const rim = Math.exp(-((dist - 2) ** 2) * 2.8) * 0.055;
      return sum + bowl + rim;
    }, 0);
    const duneBands =
      Math.exp(-((y + 15.5) ** 2) * 0.0048) * 0.3 +
      Math.exp(-((y - 18.5) ** 2) * 0.0042) * 0.22 +
      Math.exp(-((y + 2.5) ** 2) * 0.0038) * 0.12;
    const height = ridge + basin + ripple + crater + excavation + duneBands;
    position.setZ(index, height);
  }

  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x60372a,
      roughness: 0.95,
      metalness: 0.04,
      emissive: 0x8d4a31,
      emissiveIntensity: 0.4,
    }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(2, -0.34, -4.8);
  return terrain;
}

function createRockField(): THREE.Object3D {
  const group = new THREE.Group();
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a4738,
    roughness: 0.98,
    metalness: 0.02,
    emissive: 0x4a2c21,
    emissiveIntensity: 0.16,
  });

  const rockPositions: Array<[number, number, number, number, number, number, number]> = [
    [-8.2, 0.05, 3.8, 0.5, 0.26, 0.34, 0.4],
    [-6.7, 0.07, 0.6, 0.34, 0.22, 0.28, -0.2],
    [-4.5, 0.04, -4.8, 0.6, 0.24, 0.4, 0.2],
    [-1.4, 0.03, 4.4, 0.38, 0.2, 0.24, -0.4],
    [0.8, 0.05, -5.8, 0.52, 0.25, 0.36, 0.1],
    [3.6, 0.06, 4.2, 0.46, 0.22, 0.3, -0.1],
    [6.2, 0.05, -4.5, 0.58, 0.26, 0.42, 0.34],
    [8.7, 0.08, 1.2, 0.44, 0.24, 0.32, -0.22],
    [10.4, 0.04, -2.2, 0.34, 0.18, 0.24, 0.5],
    [-9.6, 0.03, -2.8, 0.28, 0.16, 0.22, -0.3],
    [1.9, 0.03, 6.1, 0.26, 0.15, 0.18, 0.12],
    [5.1, 0.02, 6.4, 0.22, 0.12, 0.16, -0.18],
  ];

  rockPositions.forEach(([x, y, z, sx, sy, sz, rot]) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockMaterial);
    rock.position.set(x, y, z);
    rock.scale.set(sx, sy, sz);
    rock.rotation.set(rot * 0.4, rot, rot * 0.2);
    group.add(rock);
  });

  return group;
}

function createDustHaze(): THREE.Object3D {
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(84, 26),
    new THREE.MeshBasicMaterial({
      color: 0xb86646,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    }),
  );
  haze.position.set(1.4, 3.1, -24.5);
  return haze;
}

function createSunDisc(): THREE.Object3D {
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 40),
    new THREE.MeshBasicMaterial({
      color: 0xf0b27c,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    }),
  );
  sun.position.set(-13.8, 6.8, -24.8);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(5.6, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd97a4b,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  halo.position.copy(sun.position);

  const group = new THREE.Group();
  group.add(halo, sun);
  return group;
}

function createHorizonGlow(): THREE.Object3D {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(88, 12),
    new THREE.MeshBasicMaterial({
      color: 0xcd754c,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  glow.position.set(2, 1.15, -26.2);
  return glow;
}

function createAtmosphereArc(): THREE.Object3D {
  const arc = new THREE.Mesh(
    new THREE.CircleGeometry(24, 56, Math.PI, Math.PI),
    new THREE.MeshBasicMaterial({
      color: 0x9a4d31,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  arc.position.set(1.8, 3.3, -27.4);
  arc.scale.set(1.86, 0.22, 1);
  return arc;
}

function createMountainRange(): THREE.Object3D {
  const group = new THREE.Group();
  const backMaterial = new THREE.MeshBasicMaterial({
    color: 0x67392d,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const midMaterial = new THREE.MeshBasicMaterial({
    color: 0x7a4334,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const frontMaterial = new THREE.MeshBasicMaterial({
    color: 0x8f513d,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });

  const back = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
    new THREE.PlaneGeometry(56, 4),
    backMaterial,
  );
  back.position.set(2.2, 0.95, -31.8);

  const mid = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
    new THREE.PlaneGeometry(52, 3.4),
    midMaterial,
  );
  mid.position.set(2.4, 0.74, -26.4);

  const front = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
    new THREE.PlaneGeometry(48, 2.8),
    frontMaterial,
  );
  front.position.set(2.7, 0.52, -21.3);

  const backShape = createMountainShapeGeometry(
    [-28, -24, -20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20, 24, 28],
    [0.2, 0.34, 0.48, 0.58, 0.66, 0.62, 0.54, 0.46, 0.52, 0.6, 0.64, 0.58, 0.46, 0.34, 0.22],
  );
  const midShape = createMountainShapeGeometry(
    [-26, -22, -18, -14, -10, -6, -2, 2, 6, 10, 14, 18, 22, 26],
    [0.12, 0.22, 0.34, 0.42, 0.46, 0.4, 0.32, 0.28, 0.36, 0.44, 0.42, 0.34, 0.24, 0.14],
  );
  const frontShape = createMountainShapeGeometry(
    [-24, -20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20, 24],
    [0.08, 0.16, 0.24, 0.28, 0.3, 0.26, 0.2, 0.24, 0.3, 0.26, 0.22, 0.16, 0.1],
  );
  back.geometry.dispose();
  mid.geometry.dispose();
  front.geometry.dispose();
  back.geometry = backShape;
  mid.geometry = midShape;
  front.geometry = frontShape;

  group.add(back, mid, front);

  return group;
}

function createDustField(): THREE.Object3D {
  const geometry = new THREE.BufferGeometry();
  const count = 58;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const i = index * 3;
    positions[i] = THREE.MathUtils.randFloatSpread(38);
    positions[i + 1] = THREE.MathUtils.randFloat(0.4, 4.8);
    positions[i + 2] = THREE.MathUtils.randFloat(-22, 4);
    colors[i] = 0.62;
    colors[i + 1] = 0.4;
    colors[i + 2] = 0.31;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.08,
      transparent: true,
      opacity: 0.14,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function createHumanOutpost(): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(12.8, 0.02, -8.8);
  group.rotation.y = -0.34;

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x624236,
    roughness: 0.96,
    metalness: 0.04,
    emissive: 0x341d17,
    emissiveIntensity: 0.08,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xc6c1b4,
    roughness: 0.5,
    metalness: 0.26,
    emissive: 0x43352b,
    emissiveIntensity: 0.06,
  });
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0xe4dfd2,
    roughness: 0.4,
    metalness: 0.22,
    emissive: 0x51453b,
    emissiveIntensity: 0.08,
  });
  const darkHullMaterial = new THREE.MeshStandardMaterial({
    color: 0x8f8f90,
    roughness: 0.64,
    metalness: 0.18,
    emissive: 0x302a28,
    emissiveIntensity: 0.08,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x95b3ba,
    roughness: 0.1,
    metalness: 0.08,
    transparent: true,
    opacity: 0.34,
    emissive: 0x5f8a84,
    emissiveIntensity: 0.22,
  });

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.22, 40), deckMaterial);
  pad.position.set(0, 0.08, 0);
  group.add(pad);

  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(2.74, 3.16, 56),
    new THREE.MeshBasicMaterial({
      color: 0xb7815c,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.205;
  group.add(padRing);

  const centralHub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.22, 0.66, 24), hullMaterial);
  centralHub.position.set(-0.6, 0.48, 0.28);
  group.add(centralHub);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.92, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56),
    glassMaterial,
  );
  dome.scale.set(1.2, 0.72, 1.04);
  dome.position.set(-0.58, 0.98, 0.28);
  group.add(dome);

  const opsWing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.44, 0.9), hullMaterial);
  opsWing.position.set(1.22, 0.44, 0.48);
  group.add(opsWing);

  const labWing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.76), darkHullMaterial);
  labWing.position.set(-1.8, 0.4, -0.88);
  labWing.rotation.y = 0.12;
  group.add(labWing);

  const serviceWing = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.34, 0.7), darkHullMaterial);
  serviceWing.position.set(0.78, 0.36, -1.12);
  serviceWing.rotation.y = -0.1;
  group.add(serviceWing);

  const corridorMaterial = new THREE.MeshStandardMaterial({
    color: 0xb1aca1,
    roughness: 0.54,
    metalness: 0.18,
    emissive: 0x3b322d,
    emissiveIntensity: 0.06,
  });
  [
    { x: -1.16, z: -0.42, length: 1.28, rot: -0.78 },
    { x: 0.34, z: 0.42, length: 1.42, rot: 0.18 },
    { x: 0.02, z: -0.66, length: 1.08, rot: -0.54 },
  ].forEach(({ x, z, length, rot }) => {
    const corridor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, length, 12), corridorMaterial);
    corridor.rotation.z = Math.PI / 2;
    corridor.rotation.y = rot;
    corridor.position.set(x, 0.46, z);
    group.add(corridor);
  });

  const solarPanelMaterial = new THREE.MeshStandardMaterial({
    color: 0x384b63,
    roughness: 0.34,
    metalness: 0.46,
    emissive: 0x223140,
    emissiveIntensity: 0.12,
  });
  const trussMaterial = new THREE.MeshStandardMaterial({
    color: 0xbab5aa,
    roughness: 0.6,
    metalness: 0.26,
  });

  [
    { x: -3.05, z: 1.35, rot: 0.3 },
    { x: -2.85, z: -1.82, rot: -0.1 },
    { x: 2.64, z: 1.62, rot: -0.24 },
  ].forEach(({ x, z, rot }) => {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), trussMaterial);
    mast.position.set(x, 0.28, z);
    const array = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.04, 0.62), solarPanelMaterial);
    array.position.set(x, 0.52, z);
    array.rotation.y = rot;
    array.rotation.z = -0.18;
    group.add(mast, array);
  });

  const commsMast = new THREE.Group();
  const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.7, 8), trimMaterial);
  mastPole.position.y = 0.95;
  const mastDish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI), trimMaterial);
  mastDish.rotation.z = -Math.PI / 2;
  mastDish.position.set(0.14, 1.56, 0);
  const mastBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x98d0ff, transparent: true, opacity: 0.82 }),
  );
  mastBeacon.position.set(0, 1.84, 0);
  commsMast.position.set(2.08, 0.08, -0.42);
  commsMast.add(mastPole, mastDish, mastBeacon);
  group.add(commsMast);

  const cargoPads = new THREE.Group();
  [
    { x: 1.95, z: -2.08, sx: 0.84, sz: 0.58 },
    { x: 2.72, z: -1.52, sx: 0.6, sz: 0.48 },
    { x: -2.52, z: 2.0, sx: 0.68, sz: 0.48 },
  ].forEach(({ x, z, sx, sz }) => {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.32), darkHullMaterial);
    crate.position.set(x, 0.22, z);
    crate.scale.set(sx, 1, sz);
    cargoPads.add(crate);
  });
  group.add(cargoPads);

  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(-5.45, 0.08, 0.52);
  rocketGroup.rotation.y = 0.08;

  const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3.6, 20), hullMaterial);
  rocketBody.position.y = 2.0;
  const rocketNose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.88, 20), trimMaterial);
  rocketNose.position.y = 4.24;
  const rocketBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.42, 20), darkHullMaterial);
  rocketBase.position.y = 0.42;
  const engineBellMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f6d60,
    roughness: 0.54,
    metalness: 0.34,
  });
  [
    [0, 0],
    [0.18, 0.16],
    [-0.18, 0.16],
    [0.18, -0.16],
    [-0.18, -0.16],
  ].forEach(([x, z]) => {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.22, 10), engineBellMaterial);
    bell.position.set(x, 0.14, z);
    rocketGroup.add(bell);
  });

  const finMaterial = trimMaterial;
  [
    { x: 0.33, z: 0, rot: 0 },
    { x: -0.33, z: 0, rot: Math.PI },
    { x: 0, z: 0.33, rot: Math.PI / 2 },
    { x: 0, z: -0.33, rot: -Math.PI / 2 },
  ].forEach(({ x, z, rot }) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.34), finMaterial);
    fin.position.set(x, 0.62, z);
    fin.rotation.y = rot;
    rocketGroup.add(fin);
  });

  const hatchBand = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.018, 8, 28), darkHullMaterial);
  hatchBand.rotation.x = Math.PI / 2;
  hatchBand.position.y = 2.94;
  rocketGroup.add(rocketBody, rocketNose, rocketBase, hatchBand);

  const gantry = new THREE.Group();
  const gantryMaterial = new THREE.MeshStandardMaterial({
    color: 0xb2a89f,
    roughness: 0.68,
    metalness: 0.18,
  });
  [-0.42, 0.42].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.7, 0.08), gantryMaterial);
    leg.position.set(x, 1.35, -0.72);
    gantry.add(leg);
  });
  const gantryTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), gantryMaterial);
  gantryTop.position.set(0, 2.62, -0.72);
  const gantryArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.02), gantryMaterial);
  gantryArm.position.set(0.38, 2.44, -0.3);
  gantry.add(gantryTop, gantryArm);
  rocketGroup.add(gantry);

  const rocketPad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.28, 0.12, 28), deckMaterial);
  rocketPad.position.y = 0.06;
  rocketGroup.add(rocketPad);

  group.add(rocketGroup);

  return group;
}

function createMountainShapeGeometry(xs: number[], ys: number[]): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [new THREE.Vector2(xs[0] ?? -16, -3)];
  xs.forEach((x, index) => {
    points.push(new THREE.Vector2(x, ys[index] ?? 0));
  });
  points.push(new THREE.Vector2(xs[xs.length - 1] ?? 16, -3));
  const shape = new THREE.Shape(points);
  return new THREE.ShapeGeometry(shape);
}

function createHabitatWalkwayNetwork(placements: HabitatPlacement[]): THREE.Object3D {
  const group = new THREE.Group();
  const deckY = 0.24;
  const deckThickness = 0.1;
  const supportY = 0.125;

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8d3c9,
    roughness: 0.84,
    metalness: 0.06,
    emissive: 0x75695a,
    emissiveIntensity: 0.06,
  });
  const supportMaterial = new THREE.MeshStandardMaterial({
    color: 0x7e685c,
    roughness: 0.92,
    metalness: 0.04,
    emissive: 0x382a24,
    emissiveIntensity: 0.04,
  });
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1eee7,
    roughness: 0.52,
    metalness: 0.08,
    emissive: 0x8d8176,
    emissiveIntensity: 0.08,
  });

  const addPad = (x: number, z: number, radius = 0.62) => {
    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.94, radius, deckThickness * 0.78, 24),
      supportMaterial,
    );
    support.position.set(x, supportY, z);
    group.add(support);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, deckThickness, 24), baseMaterial);
    pad.position.set(x, deckY, z);
    group.add(pad);

    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, 0.02, 20),
      stripeMaterial,
    );
    inner.position.set(x, deckY + deckThickness * 0.58, z);
    group.add(inner);
  };

  const addSegment = (start: THREE.Vector3, end: THREE.Vector3, width = 0.72) => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    if (length <= 0.001) {
      return;
    }

    const angle = Math.atan2(delta.x, delta.z);
    const center = start.clone().lerp(end, 0.5);

    const support = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.86, deckThickness * 0.72, length * 0.98),
      supportMaterial,
    );
    support.position.set(center.x, supportY, center.z);
    support.rotation.y = angle;
    group.add(support);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, deckThickness, length), baseMaterial);
    slab.position.set(center.x, deckY, center.z);
    slab.rotation.y = angle;
    group.add(slab);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.46, 0.018, length * 0.9),
      stripeMaterial,
    );
    stripe.position.set(center.x, deckY + deckThickness * 0.58, center.z);
    stripe.rotation.y = angle;
    group.add(stripe);
  };

  const zoneA = placements[0];
  const zoneB = placements[1];
  const zoneC = placements[2];
  const zoneD = placements[3];

  if (!zoneA || !zoneB || !zoneC || !zoneD) {
    return group;
  }

  const aDock = new THREE.Vector3(zoneA.x + 1.54, 0, zoneA.z + 0.04);
  const bDockWest = new THREE.Vector3(zoneB.x - 1.5, 0, zoneB.z + 0.04);
  const bDockSouth = new THREE.Vector3(zoneB.x + 0.06, 0, zoneB.z + 1.48);
  const cDockNorth = new THREE.Vector3(zoneC.x + 0.03, 0, zoneC.z - 1.58);
  const cDockEast = new THREE.Vector3(zoneC.x + 1.52, 0, zoneC.z + 0.04);
  const dDock = new THREE.Vector3(zoneD.x - 1.52, 0, zoneD.z + 0.02);
  const hqDock = new THREE.Vector3(10.0, 0, -6.42);

  const topLeft = new THREE.Vector3(-3.88, 0, 2.48);
  const topMid = new THREE.Vector3(-0.18, 0, 2.48);
  const rightMid = new THREE.Vector3(3.82, 0, -0.08);
  const bottomMid = new THREE.Vector3(-0.18, 0, -3.06);
  const leftMid = new THREE.Vector3(-3.92, 0, -1.78);
  const hqJunction = new THREE.Vector3(7.88, 0, -4.56);

  [
    aDock,
    bDockWest,
    bDockSouth,
    cDockNorth,
    cDockEast,
    dDock,
    hqDock,
    topLeft,
    topMid,
    rightMid,
    bottomMid,
    leftMid,
    hqJunction,
  ].forEach((point) => addPad(point.x, point.z, point === hqDock ? 0.8 : 0.56));

  const networkSegments: Array<[THREE.Vector3, THREE.Vector3]> = [
    [aDock, topLeft],
    [topLeft, topMid],
    [topMid, bDockWest],
    [bDockSouth, rightMid],
    [rightMid, dDock],
    [dDock, bottomMid],
    [bottomMid, cDockEast],
    [cDockNorth, leftMid],
    [leftMid, topLeft],
    [dDock, hqJunction],
    [hqJunction, hqDock],
  ];

  networkSegments.forEach(([start, end]) => addSegment(start, end));

  return group;
}

function createHabitat(summary: GreenhouseSummary, label: HTMLElement): HabitatInstance {
  const tone = greenhouseToneColor(summary.status);
  const builder = habitatBuilders[summary.silhouette];
  const spec = builder(tone);

  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1f3f1,
    transparent: true,
    opacity: 0.19,
    emissive: 0x8ca0ab,
    emissiveIntensity: 0.12,
    roughness: 0.12,
    metalness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(spec.shellGeometry, shellMaterial);
  if (spec.shellScale) {
    shell.scale.set(...spec.shellScale);
  }
  if (spec.shellPosition) {
    shell.position.set(...spec.shellPosition);
  }

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(shell.geometry, 24),
    new THREE.LineBasicMaterial({ color: 0xf2f5f8, transparent: true, opacity: 0.72 }),
  );
  frame.scale.copy(shell.scale);
  frame.position.copy(shell.position);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.9, 48),
    new THREE.MeshBasicMaterial({
      color: tone,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  if (spec.ringScale) {
    ring.scale.set(...spec.ringScale);
  }

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.68, 0.18, 28),
    new THREE.MeshStandardMaterial({
      color: 0xd8d2c8,
      roughness: 0.82,
      metalness: 0.06,
      emissive: 0x73685f,
      emissiveIntensity: 0.05,
    }),
  );
  if (spec.platformScale) {
    base.scale.set(...spec.platformScale);
  }
  base.position.y = -0.02;

  const berm = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.16, 14, 64),
    new THREE.MeshStandardMaterial({
      color: 0xc9c2b7,
      roughness: 0.92,
      metalness: 0.03,
      emissive: 0x665950,
      emissiveIntensity: 0.04,
    }),
  );
  berm.rotation.x = Math.PI / 2;
  berm.position.y = 0.01;
  if (spec.bermScale) {
    berm.scale.set(...spec.bermScale);
  }

  const canopy = new THREE.Mesh(
    new THREE.CircleGeometry(1.02, 40),
    new THREE.MeshStandardMaterial({
      color: 0x355233,
      roughness: 0.94,
      metalness: 0.02,
      emissive: 0x28452b,
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 0.94,
    }),
  );
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.set(0, 0.06, 0);
  if (spec.canopyScale) {
    canopy.scale.set(...spec.canopyScale);
  }
  if (spec.canopyPosition) {
    canopy.position.set(...spec.canopyPosition);
  }

  const garden = spec.garden ?? createInteriorGarden(summary.silhouette);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 14),
    new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: 0.82 }),
  );
  if (spec.corePosition) {
    core.position.set(...spec.corePosition);
  } else {
    core.position.set(0, 0.95, 0);
  }

  const root = new THREE.Group();
  root.add(base, berm, canopy, garden, ring, shell, frame, core);
  spec.frameExtras?.forEach((extra) => root.add(extra));

  [shell, frame, ring, base, berm, canopy].forEach((object) => {
    object.userData.greenhouseId = summary.id;
  });

  return {
    id: summary.id,
    summary,
    root,
    shell,
    frame,
    ring,
    label,
    baseY: 0,
    baseRotationY: 0,
    hoverMix: 0,
    pulseOffset: Math.random() * Math.PI * 2,
  };
}

const habitatBuilders: Record<GreenhouseSummary["silhouette"], HabitatBuilder> = {
  arched: () => ({
    shellGeometry: new THREE.SphereGeometry(1.42, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.62),
    shellScale: [1.92, 0.9, 1.64],
    shellPosition: [0, 0.08, 0],
    frameExtras: [
      ...createDomeLattice(1.88, 1.28, 1.56, 9, 5),
    ],
    garden: createInteriorGarden("arched"),
    platformScale: [1.5, 1, 1.28],
    bermScale: [1.24, 1.22, 1.08],
    canopyScale: [1.56, 1, 1.34],
    ringScale: [1.32, 1.28, 1.1],
    corePosition: [0, 1.08, 0],
  }),
  spine: () => ({
    shellGeometry: new THREE.SphereGeometry(1.36, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.56),
    shellScale: [1.48, 0.74, 1.26],
    shellPosition: [0, 0.02, 0],
    frameExtras: [
      ...createDomeLattice(1.44, 0.96, 1.2, 7, 4),
    ],
    garden: createInteriorGarden("spine"),
    platformScale: [1.2, 1, 1.06],
    bermScale: [1.06, 1.02, 1.0],
    canopyScale: [1.12, 1, 1.0],
    ringScale: [1.08, 1.06, 1.04],
    corePosition: [0, 0.88, 0],
  }),
  vault: () => ({
    shellGeometry: new THREE.SphereGeometry(1.34, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
    shellScale: [2.42, 0.6, 1.06],
    shellPosition: [0.1, 0.02, 0],
    frameExtras: [
      ...createDomeLattice(2.78, 0.82, 0.94, 10, 4),
    ],
    garden: createInteriorGarden("vault"),
    platformScale: [1.68, 1, 1.0],
    bermScale: [1.6, 1.06, 0.98],
    canopyScale: [1.98, 1, 0.9],
    canopyPosition: [0.08, 0.06, 0],
    ringScale: [1.42, 1.14, 0.96],
    corePosition: [0.26, 0.76, 0],
  }),
  spire: () => ({
    shellGeometry: new THREE.SphereGeometry(1.3, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.64),
    shellScale: [1.42, 0.96, 1.26],
    shellPosition: [0, 0.06, 0],
    frameExtras: [
      ...createDomeLattice(1.72, 1.22, 1.48, 9, 5),
    ],
    garden: createInteriorGarden("spire"),
    platformScale: [1.26, 1, 1.12],
    bermScale: [1.12, 1.12, 1.06],
    canopyScale: [1.08, 1, 1.04],
    ringScale: [1.12, 1.12, 1.06],
    corePosition: [0, 1.14, 0],
  }),
};

function createDomeLattice(
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  meridians = 6,
  latitudes = 4,
): THREE.Object3D[] {
  const tone = 0xf1f4f8;
  const elements: THREE.Object3D[] = [];
  const meridianMaterial = new THREE.LineBasicMaterial({ color: tone, transparent: true, opacity: 0.38 });
  const latitudeMaterial = new THREE.LineBasicMaterial({ color: tone, transparent: true, opacity: 0.26 });

  for (let index = 0; index < meridians; index += 1) {
    const rotation = (index / meridians) * Math.PI;
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 22; step += 1) {
      const t = step / 22;
      const angle = Math.PI * t;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radiusX,
          Math.sin(angle) * radiusY,
          0,
        ).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation),
      );
    }
    elements.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), meridianMaterial));
  }

  for (let index = 1; index <= latitudes; index += 1) {
    const t = index / (latitudes + 1);
    const y = Math.sin((Math.PI / 2) * t) * radiusY;
    const ringRadiusX = Math.cos((Math.PI / 2) * t) * radiusX;
    const ringRadiusZ = Math.cos((Math.PI / 2) * t) * radiusZ;
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 36; step += 1) {
      const angle = (step / 36) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * ringRadiusX, y, Math.sin(angle) * ringRadiusZ));
    }
    elements.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), latitudeMaterial));
  }

  return elements;
}

function createRaisedFrame(): THREE.Object3D {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0xf1f4f8, transparent: true, opacity: 0.32 });
  [-1, 1].forEach((side) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(side * 0.84, 0.08, -0.72),
        new THREE.Vector3(side * 0.34, 1.78, -0.1),
        new THREE.Vector3(side * 0.22, 2.18, 0),
      ]),
      material,
    );
    const lineRear = line.clone();
    lineRear.position.z = 1.44;
    group.add(line, lineRear);
  });

  const bridge = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.22, 2.18, 0),
      new THREE.Vector3(0.22, 2.18, 0),
    ]),
    material,
  );
  group.add(bridge);
  return group;
}

function createInteriorGarden(silhouette: GreenhouseSummary["silhouette"]): THREE.Object3D {
  const group = new THREE.Group();
  group.position.y = 0.08;

  const footprintBySilhouette: Record<GreenhouseSummary["silhouette"], { rx: number; rz: number; rows: number; cols: number }> = {
    arched: { rx: 1.35, rz: 1.12, rows: 6, cols: 7 },
    spine: { rx: 0.96, rz: 0.82, rows: 5, cols: 5 },
    vault: { rx: 1.72, rz: 0.74, rows: 5, cols: 9 },
    spire: { rx: 0.94, rz: 0.86, rows: 5, cols: 5 },
  };
  const footprint = footprintBySilhouette[silhouette];

  const bedMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e4e31,
    roughness: 0.96,
    metalness: 0.02,
    emissive: 0x355b37,
    emissiveIntensity: 0.18,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x6e9f58,
    roughness: 0.88,
    metalness: 0.01,
    emissive: 0x355d33,
    emissiveIntensity: 0.12,
  });

  for (let row = 0; row < footprint.rows; row += 1) {
    for (let col = 0; col < footprint.cols; col += 1) {
      const u = footprint.cols === 1 ? 0.5 : col / (footprint.cols - 1);
      const v = footprint.rows === 1 ? 0.5 : row / (footprint.rows - 1);
      const x = (u - 0.5) * footprint.rx * 2;
      const z = (v - 0.5) * footprint.rz * 2;
      const normalized = (x * x) / (footprint.rx * footprint.rx) + (z * z) / (footprint.rz * footprint.rz);
      if (normalized > 0.96) {
        continue;
      }

      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.04, 0.22),
        bedMaterial,
      );
      bed.position.set(x, 0, z);

      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + ((row + col) % 3) * 0.01, 8, 8),
        leafMaterial,
      );
      leaf.scale.set(1.2, 0.7 + ((row + col) % 2) * 0.18, 1);
      leaf.position.set(x, 0.08 + ((row + col) % 2) * 0.02, z);

      group.add(bed, leaf);
    }
  }

  return group;
}

void createRaisedFrame;

function buildGreenhouseHoverSnapshots(
  greenhouses: GreenhouseSummary[],
  mission: BackendMissionState | null,
): GreenhouseHoverSnapshot[] {
  return greenhouses.map((greenhouse) => {
    const zone = mission?.zones.find((entry) => entry.zoneId === greenhouse.zoneId);
    const zoneHealthTone = zone ? landingZoneTone(zone) : greenhouse.status;
    const stateTone = zone?.stress.active ? landingStressTone(zone.stress.severity) : zoneHealthTone;

    return {
      greenhouseId: greenhouse.id,
      greenhouseName: greenhouse.name,
      greenhouseCode: greenhouse.code,
      plantCount: greenhouse.plantCount,
      zoneId: greenhouse.zoneId,
      cropLabel: zone ? formatLandingCrop(zone.cropType) : formatLandingCrop(greenhouse.cropType),
      healthLabel: zone ? formatLandingZoneStatus(zone.status) : renderStatusWord(greenhouse.status),
      healthTone: zoneHealthTone,
      stateLabel: zone?.stress.active ? zone.stress.severity : "Stable",
      stateTone,
      growthDay: zone?.growthDay ?? 0,
      growthCycleDays: zone?.growthCycleDays ?? 0,
      growthProgressPercent: zone?.growthProgressPercent ?? 0,
      projectedYieldKg: zone?.projectedYieldKg ?? 0,
      allocationPercent: zone?.allocationPercent ?? 0,
      summary: zone
        ? zone.stress.active
          ? zone.stress.summary
          : `${greenhouse.name} remains within the target operating band.`
        : `${greenhouse.name} is standing by for live telemetry.`,
      metrics: zone
        ? [
            { label: "Temp", value: `${zone.sensors.temperature} C`, tone: "NOM" as StatusTone },
            { label: "Humidity", value: `${zone.sensors.humidity}%`, tone: "NOM" as StatusTone },
            { label: "PAR", value: `${zone.sensors.lightPAR}`, tone: "NOM" as StatusTone },
            { label: "Moisture", value: `${zone.sensors.soilMoisture}%`, tone: "NOM" as StatusTone },
            { label: "pH", value: `${zone.sensors.nutrientPH}`, tone: "NOM" as StatusTone },
            { label: "EC", value: `${zone.sensors.electricalConductivity} mS`, tone: "NOM" as StatusTone },
          ]
        : [
            { label: "Temp", value: "--", tone: "CAU" as StatusTone },
            { label: "Humidity", value: "--", tone: "CAU" as StatusTone },
            { label: "PAR", value: "--", tone: "CAU" as StatusTone },
            { label: "Moisture", value: "--", tone: "CAU" as StatusTone },
            { label: "pH", value: "--", tone: "CAU" as StatusTone },
            { label: "EC", value: "--", tone: "CAU" as StatusTone },
          ],
    };
  });
}

function landingZoneTone(zone: BackendCropZone): StatusTone {
  if (zone.status === "critical" || zone.status === "offline" || zone.stress.severity === "critical") {
    return "ABT";
  }
  if (
    zone.status === "stressed" ||
    zone.status === "harvesting" ||
    zone.stress.severity === "moderate" ||
    zone.stress.severity === "high" ||
    zone.stress.severity === "low"
  ) {
    return "CAU";
  }
  return "NOM";
}

function landingStressTone(severity: string): StatusTone {
  if (severity === "critical") {
    return "ABT";
  }
  if (severity === "moderate" || severity === "high" || severity === "low") {
    return "CAU";
  }
  return "NOM";
}

function formatLandingCrop(type: GreenhouseSummary["cropType"]): string {
  switch (type) {
    case "beans":
      return "Beans";
    case "potato":
      return "Potato";
    case "radish":
      return "Radish";
    default:
      return "Lettuce";
  }
}

function formatLandingZoneStatus(status: BackendCropZone["status"]): string {
  switch (status) {
    case "critical":
      return "Critical";
    case "healthy":
      return "Healthy";
    case "harvesting":
      return "Harvesting";
    case "offline":
      return "Offline";
    default:
      return "Stressed";
  }
}

function renderLandingBadge(label: string, tone: StatusTone): string {
  return `<span class="landing-zone-card__badge landing-zone-card__badge--${tone.toLowerCase()} mono">[ ${escapeHtml(label)} ]</span>`;
}

function greenhouseToneColor(status: GreenhouseSummary["status"]): THREE.ColorRepresentation {
  switch (status) {
    case "ABT":
      return 0xcf6056;
    case "CAU":
      return 0xd1aa67;
    default:
      return 0x8cb9d7;
  }
}

function renderStatusWord(status: GreenhouseSummary["status"]): string {
  switch (status) {
    case "ABT":
      return "Critical";
    case "CAU":
      return "Watch";
    default:
      return "Nominal";
  }
}

function disposeHabitat(habitat: HabitatInstance): void {
  disposeObject(habitat.root);
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child: THREE.Object3D) => {
    const geometry = (child as THREE.Mesh).geometry;
    if (geometry) {
      geometry.dispose();
    }

    const material = (child as THREE.Mesh).material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

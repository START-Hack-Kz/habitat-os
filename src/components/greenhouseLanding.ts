import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { GreenhouseSummary } from "../types";

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
): string {
  return `
    <section class="landing-scene" aria-label="Greenhouse selection">
      <div class="landing-scene__hud">
        <span class="landing-scene__label mono">AETHER Habitat Array</span>
        <span class="landing-scene__sol mono">SOL ${String(missionDay ?? 0).padStart(3, "0")}</span>
      </div>
      <div class="landing-scene__viewport" data-landing-viewport="true" aria-hidden="true"></div>
      <div class="landing-scene__labels" data-landing-labels="true">
        ${greenhouses
          .map(
            (greenhouse) => `
              <div class="landing-tag landing-tag--${greenhouse.status.toLowerCase()}" data-greenhouse-label="${escapeHtml(greenhouse.id)}">
                <span class="landing-tag__code mono">${escapeHtml(greenhouse.code)}</span>
                <span class="landing-tag__name">${escapeHtml(greenhouse.name)}</span>
                <span class="landing-tag__signal mono">${escapeHtml(renderStatusWord(greenhouse.status))}</span>
              </div>
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

  if (!viewport || !labelHost) {
    return { dispose: () => undefined };
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x04060b, 1);
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x09080c, 0.042);

  const camera = new THREE.PerspectiveCamera(
    38,
    Math.max(viewport.clientWidth, 1) / Math.max(viewport.clientHeight, 1),
    0.1,
    100,
  );
  camera.position.set(1.4, 8.8, 15.8);
  camera.lookAt(0.6, 0.6, 0.3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.target.set(0.8, 0.55, 0);

  const ambient = new THREE.AmbientLight(0xcfd5e5, 0.32);
  const hemisphere = new THREE.HemisphereLight(0x6d7d96, 0x2c1b17, 0.76);
  const key = new THREE.DirectionalLight(0x8ea6cc, 1.05);
  key.position.set(6, 8, 5);
  const rim = new THREE.DirectionalLight(0x8a4437, 0.62);
  rim.position.set(-5, 2, -7);
  const sunLight = new THREE.DirectionalLight(0xf0a168, 0.92);
  sunLight.position.set(-9, 6, -10);
  const marsGlow = new THREE.PointLight(0x8a3f31, 0.8, 30, 2);
  marsGlow.position.set(0, 1.4, -9);
  scene.add(ambient, hemisphere, key, rim, sunLight, marsGlow);

  scene.add(createTerrain());
  scene.add(createRockField());
  scene.add(createDustHaze());
  scene.add(createSunDisc());
  scene.add(createMountainRange());
  scene.add(createHorizonGlow());
  scene.add(createAtmosphereArc());
  scene.add(createDustField());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const interactiveMeshes: THREE.Object3D[] = [];
  const labelMap = new Map<string, HTMLElement>();
  const habitats: HabitatInstance[] = [];

  labelHost.querySelectorAll<HTMLElement>("[data-greenhouse-label]").forEach((label) => {
    const id = label.dataset.greenhouseLabel ?? "";
    if (id) {
      labelMap.set(id, label);
    }
  });

  const habitatPlacements = [
    { x: -5.4, z: 2.7, y: 0.28, rotY: -0.18 },
    { x: 1.65, z: 2.0, y: 0.24, rotY: 0.14 },
    { x: -2.3, z: -3.6, y: 0.2, rotY: -0.04 },
    { x: 5.9, z: -2.9, y: 0.32, rotY: 0.24 },
  ];

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

      const bob = Math.sin(elapsed * 0.65 + habitat.pulseOffset) * 0.07;
      habitat.root.position.y = habitat.baseY + bob + habitat.hoverMix * 0.32;
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
  const geometry = new THREE.PlaneGeometry(34, 26, 64, 52);
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
    const ridge = Math.sin(x * 0.24) * 0.22;
    const basin = Math.cos(y * 0.18) * 0.18;
    const ripple = Math.sin((x + y) * 0.3) * 0.07 + Math.cos((x - y) * 0.22) * 0.05;
    const crater =
      Math.exp(-((x - 3.2) ** 2 + (y + 1.8) ** 2) * 0.08) * -0.22 +
      Math.exp(-((x + 4.6) ** 2 + (y - 3.2) ** 2) * 0.05) * -0.14;
    const excavation = habitatBasins.reduce((sum, basinCenter) => {
      const dx = x - basinCenter.x;
      const dy = y - basinCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const bowl = Math.exp(-(dist * dist) * 0.92) * -0.18;
      const rim = Math.exp(-((dist - 1.9) ** 2) * 3.4) * 0.09;
      return sum + bowl + rim;
    }, 0);
    const height = ridge + basin + ripple + crater + excavation;
    position.setZ(index, height);
  }

  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x4a2b24,
      roughness: 0.95,
      metalness: 0.04,
      emissive: 0x6f3a29,
      emissiveIntensity: 0.3,
    }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(1.4, -0.24, -0.2);
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
    new THREE.PlaneGeometry(38, 18),
    new THREE.MeshBasicMaterial({
      color: 0xa35339,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  haze.position.set(0, 4.1, -10.6);
  return haze;
}

function createSunDisc(): THREE.Object3D {
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 40),
    new THREE.MeshBasicMaterial({
      color: 0xe8a06a,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    }),
  );
  sun.position.set(-8.8, 5.4, -12.6);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(2.9, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd87949,
      transparent: true,
      opacity: 0.22,
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
    new THREE.PlaneGeometry(36, 9),
    new THREE.MeshBasicMaterial({
      color: 0xae5838,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  glow.position.set(0.7, 2.0, -11.9);
  return glow;
}

function createAtmosphereArc(): THREE.Object3D {
  const arc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 48, Math.PI, Math.PI),
    new THREE.MeshBasicMaterial({
      color: 0x763325,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  arc.position.set(0.3, 4.2, -13.2);
  arc.scale.set(1.2, 0.42, 1);
  return arc;
}

function createMountainRange(): THREE.Object3D {
  const group = new THREE.Group();
  const backMaterial = new THREE.MeshBasicMaterial({
    color: 0x4d2623,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const frontMaterial = new THREE.MeshBasicMaterial({
    color: 0x69372d,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });

  const back = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
    new THREE.PlaneGeometry(34, 6),
    backMaterial,
  );
  back.position.set(0.4, 2.3, -12.8);

  const front = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
    new THREE.PlaneGeometry(30, 4.8),
    frontMaterial,
  );
  front.position.set(0.8, 1.6, -11.4);

  const backShape = createMountainShapeGeometry(
    [-17, -15, -13.6, -11.8, -9.7, -7.1, -4.5, -1.8, 1.2, 4.3, 7.8, 11.2, 14.6, 17],
    [0.5, 1.4, 3.8, 2.6, 4.9, 2.1, 3.7, 1.9, 4.2, 2.4, 3.8, 2.7, 1.8, 0.6],
  );
  const frontShape = createMountainShapeGeometry(
    [-15, -12.8, -10.2, -7.4, -4.4, -1.5, 1.3, 4.2, 7.2, 10.4, 13.1, 15],
    [0.5, 1.3, 2.9, 1.8, 3.3, 1.6, 2.8, 1.7, 3.0, 2.1, 1.4, 0.6],
  );
  back.geometry.dispose();
  front.geometry.dispose();
  back.geometry = backShape;
  front.geometry = frontShape;

  group.add(back, front);

  return group;
}

function createDustField(): THREE.Object3D {
  const geometry = new THREE.BufferGeometry();
  const count = 72;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const i = index * 3;
    positions[i] = THREE.MathUtils.randFloatSpread(26);
    positions[i + 1] = THREE.MathUtils.randFloat(0.6, 5.5);
    positions[i + 2] = THREE.MathUtils.randFloat(-10, 6);
    colors[i] = 0.58;
    colors[i + 1] = 0.36;
    colors[i + 2] = 0.3;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.07,
      transparent: true,
      opacity: 0.2,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
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
      color: 0x5a3028,
      roughness: 0.95,
      metalness: 0.04,
      emissive: 0x2a1512,
      emissiveIntensity: 0.08,
    }),
  );
  if (spec.platformScale) {
    base.scale.set(...spec.platformScale);
  }
  base.position.y = -0.02;

  const berm = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.16, 14, 64),
    new THREE.MeshStandardMaterial({
      color: 0x6e3d31,
      roughness: 1,
      metalness: 0.02,
      emissive: 0x2a1512,
      emissiveIntensity: 0.06,
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
      ...createDomeLattice(2.28, 0.8, 1.0, 9, 4),
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
      ...createDomeLattice(1.34, 1.14, 1.18, 8, 5),
      createRaisedFrame(),
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

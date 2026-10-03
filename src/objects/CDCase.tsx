import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { useSpring, a } from "@react-spring/three";
import * as THREE from "three";
import {
  POSE,
  SPRING,
  OPEN_ROT_MIN,
  OPEN_ROT_MAX,
  wrapAngle,
} from "../config/constants";
import { useGameState, useGameDispatch } from "../state/store";
import { placeOf } from "../state/selectors";
import type { Album } from "../data/schema";

const MODEL_URL = "/models/cd_music_02.glb";
const MODEL_SCALE = 20;
const MODEL_ROT_X = -Math.PI / 2;
const GAME_DISC_DIAMETER = 2.2;

// The lid is a book cover: hinge on the LEFT, opening RIGHT -> LEFT.
const LID_OPEN_ANGLE = THREE.MathUtils.degToRad(120);

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

const findNode = (
  root: THREE.Object3D,
  wanted: string,
): THREE.Object3D | null => {
  const exact = root.getObjectByName(wanted);
  if (exact) return exact;

  const target = normalizeName(wanted);
  let result: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (!result && normalizeName(object.name) === target) result = object;
  });
  return result;
};

const findFirstCase = (
  scene: THREE.Object3D,
  nodes: Record<string, THREE.Object3D>,
): THREE.Object3D => {
  const direct =
    nodes.CD_CASE001_6 ??
    nodes["CD_CASE.001_6"] ??
    findNode(scene, "CD_CASE001_6") ??
    findNode(scene, "CD_CASE.001_6");

  if (direct) return direct;

  const candidates: THREE.Object3D[] = [];
  scene.traverse((object) => {
    const name = normalizeName(object.name);
    if (/^cdcase\d{3}\d+$/.test(name)) candidates.push(object);
  });

  candidates.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  if (candidates[0]) return candidates[0];

  throw new Error(
    `Nessuna custodia trovata in ${MODEL_URL}. ` +
      `Nodi disponibili: ${Object.keys(nodes).slice(0, 30).join(", ")}`,
  );
};

const makePrintMaterial = (texture: THREE.Texture) =>
  new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

const makeDiscMaterial = (texture: THREE.Texture) =>
  new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });

const configureBodyMaterials = (root: THREE.Object3D) => {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return;

      if (material.name === "plastic_black") {
        material.color.setRGB(0.14, 0.14, 0.14);
        material.roughness = 0.55;
        material.metalness = 0;
      }

      // The exported transparent top is disabled for now. Its original
      // material produces line artifacts over the cover in the game renderer.
      if (material.name === "Plastic_transparent") {
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
    });
  });
};

type ModelInstance = {
  root: THREE.Group;
  lidPivot: THREE.Group;
  caseDiscGroup: THREE.Object3D;
  externalDisc: THREE.Group;
  modelOffset: [number, number, number];
  discHitPosition: [number, number, number];
};

function buildModel(
  scene: THREE.Object3D,
  nodes: Record<string, THREE.Object3D>,
  frontTex: THREE.Texture,
  backTex: THREE.Texture,
  diskTex: THREE.Texture,
): ModelInstance {
  const sourceCase = findFirstCase(scene, nodes);
  const caseClone = sourceCase.clone(true);
  configureBodyMaterials(caseClone);

  // Keep the GLB's own CD_CASE transform. We put the clone in a neutral
  // wrapper so all measurements below are expressed in the same model space
  // used by the wrapper (after the GLB's original scale/translation).
  const root = new THREE.Group();
  root.name = "__CD_MODEL_ROOT__";
  root.add(caseClone);
  root.updateMatrixWorld(true);

  const frontSource = findNode(caseClone, "Object_10") as THREE.Mesh | null;
  const backMesh = findNode(caseClone, "Object_8") as THREE.Mesh | null;
  const discMesh = findNode(caseClone, "Object_5") as THREE.Mesh | null;
  const discSurface = findNode(caseClone, "Object_6");
  const topMesh = findNode(caseClone, "Object_16");
  const bodyInner = findNode(caseClone, "Object_12");
  const bodyOuter = findNode(caseClone, "Object_14");

  if (!frontSource || !backMesh || !discMesh || !bodyInner || !bodyOuter) {
    throw new Error(
      `Struttura custodia incompleta in ${MODEL_URL}: ` +
        `front=${!!frontSource} back=${!!backMesh} disc=${!!discMesh} ` +
        `inner=${!!bodyInner} outer=${!!bodyOuter}`,
    );
  }

  // Do not render the original front plane: its exported transform is -60°.
  // We rebuild only that printed surface with a deterministic hinge below.
  frontSource.visible = false;
  if (discSurface) discSurface.visible = false;
  if (topMesh) topMesh.visible = false;

  // Back insert keeps the real GLB geometry; only its album artwork changes.
  backMesh.material = makePrintMaterial(backTex);
  backMesh.castShadow = false;
  backMesh.receiveShadow = false;

  // Body bounds in ROOT MODEL SPACE (same coordinates as the new lid pivot).
  root.updateMatrixWorld(true);
  const bodyBox = new THREE.Box3();
  bodyBox.expandByObject(bodyOuter);
  bodyBox.expandByObject(bodyInner);
  bodyBox.expandByObject(backMesh);

  const bodySize = bodyBox.getSize(new THREE.Vector3());
  const bodyCenter = bodyBox.getCenter(new THREE.Vector3());

  // Object_10 is a clean rectangular plane in its local YZ plane.
  frontSource.geometry.computeBoundingBox();
  const frontBounds = frontSource.geometry.boundingBox;
  if (!frontBounds) throw new Error("Bounding box cover front non disponibile");

  const frontSize = frontBounds.getSize(new THREE.Vector3());
  const frontCenter = frontBounds.getCenter(new THREE.Vector3());
  const frontGeometry = frontSource.geometry.clone();
  frontGeometry.translate(-frontCenter.x, -frontCenter.y, -frontCenter.z);

  // GLB local Y is the thickness direction. With MODEL_ROT_X = -90°,
  // the visible side for the camera is the -Y face, so the front print sits
  // just in front of bodyBox.min.y.
  const hingeX = bodyBox.min.x;
  const frontY = bodyBox.min.y - 0.0010;
  const hingeZ = bodyCenter.z;

  const lidPivot = new THREE.Group();
  lidPivot.name = "__CD_LEFT_HINGE__";
  lidPivot.position.set(hingeX, frontY, hingeZ);
  root.add(lidPivot);

  const frontMesh = new THREE.Mesh(
    frontGeometry,
    makePrintMaterial(frontTex),
  );
  frontMesh.name = "__CD_FRONT_PRINT__";
  frontMesh.castShadow = false;
  frontMesh.receiveShadow = false;
  frontMesh.frustumCulled = false;

  // Local +X (plane normal) -> GLB -Y, which becomes camera-facing +Z
  // after the model's -90° X rotation. Local +Y -> model +X, i.e. left->right.
  frontMesh.rotation.z = -Math.PI / 2;

  // Fit the real front rectangle inside the jewel-case body with a small
  // border. Width is the mesh's LOCAL Y axis, height is LOCAL Z.
  const targetFrontWidth = Math.max(bodySize.x - 0.006, 0.001);
  const targetFrontHeight = Math.max(bodySize.z - 0.006, 0.001);
  const widthScale = targetFrontWidth / Math.max(frontSize.y, 1e-6);
  const heightScale = targetFrontHeight / Math.max(frontSize.z, 1e-6);

  frontMesh.scale.set(1, widthScale, heightScale);
  frontMesh.position.set(targetFrontWidth * 0.5, 0, 0);
  lidPivot.add(frontMesh);

  // Start closed. The animation below moves from 0° -> +120° around the
  // vertical left hinge, which makes the right side swing toward the left.
  lidPivot.rotation.z = 0;

  // IMPORTANT: Object_5 is the actual 3D CD. Object_6 is only its secondary
  // flat surface and must stay hidden or the two surfaces z-fight.
  discMesh.material = makeDiscMaterial(diskTex);
  discMesh.visible = true;

  const discGroup = discMesh.parent ?? discMesh;
  root.updateMatrixWorld(true);

  discMesh.geometry.computeBoundingBox();
  const discBounds = discMesh.geometry.boundingBox;
  if (!discBounds) throw new Error("Bounding box del disco non disponibile");

  const discCenterLocal = discBounds.getCenter(new THREE.Vector3());
  const discSize = discBounds.getSize(new THREE.Vector3());
  const discDiameter = Math.max(discSize.x, discSize.z);

  const externalDisc = new THREE.Group();
  externalDisc.name = "__CD_EXTERNAL_DISC__";

  const externalDiscMesh = discMesh.clone(false);
  externalDiscMesh.geometry = discMesh.geometry.clone();
  externalDiscMesh.geometry.translate(
    -discCenterLocal.x,
    -discCenterLocal.y,
    -discCenterLocal.z,
  );
  externalDiscMesh.material = makeDiscMaterial(diskTex);
  externalDiscMesh.frustumCulled = false;
  externalDisc.add(externalDiscMesh);

  externalDisc.scale.setScalar(
    GAME_DISC_DIAMETER / Math.max(discDiameter, 1e-6),
  );

  // All positions are in root/model space here.
  const discWorld = discMesh.getWorldPosition(new THREE.Vector3());
  const discOffset = discWorld.sub(bodyCenter);

  const modelOffsetVector = bodyCenter
    .clone()
    .applyEuler(new THREE.Euler(MODEL_ROT_X, 0, 0))
    .multiplyScalar(MODEL_SCALE);

  return {
    root,
    lidPivot,
    caseDiscGroup: discGroup,
    externalDisc,
    modelOffset: [
      -modelOffsetVector.x,
      -modelOffsetVector.y,
      -modelOffsetVector.z,
    ],
    discHitPosition: [
      discOffset.x * MODEL_SCALE,
      discOffset.y * MODEL_SCALE,
      discOffset.z * MODEL_SCALE,
    ],
  };
}

export function CDCase({ album }: { album: Album }) {
  const NO_RAYCAST = () => {};
  const DEFAULT_RAYCAST = THREE.Mesh.prototype.raycast;
  const s = useGameState();
  const dispatch = useGameDispatch();
  const [isOpen, setIsOpen] = useState(false);

  // For this pass we intentionally ignore `inside` and only map front/back/disk.
  const { front, back, disk } = album.textures;
  const [frontTex, backTex, diskTex] = useTexture([front, back, disk]);

  [frontTex, backTex, diskTex].forEach((texture) => {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;
  });

  const gltf = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Object3D;
    nodes: Record<string, THREE.Object3D>;
  };

  const model = useMemo(
    () => buildModel(gltf.scene, gltf.nodes, frontTex, backTex, diskTex),
    [gltf.scene, gltf.nodes, frontTex, backTex, diskTex],
  );

  const place = placeOf(s, album.id);
  const held = place === "hand";
  const rotatable = s.view === "case" && !held;

  const caseRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const targetY = useRef(0);
  const dragging = useRef(false);
  const rotatableRef = useRef(rotatable);
  rotatableRef.current = rotatable;

  const openRef = useRef(isOpen);
  openRef.current = isOpen;

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      if (!dragging.current || !rotatableRef.current) return;

      const next = targetY.current + ev.movementX * 0.01;
      targetY.current = openRef.current
        ? THREE.MathUtils.clamp(next, OPEN_ROT_MIN, OPEN_ROT_MAX)
        : next;
    };

    const up = () => {
      dragging.current = false;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  useEffect(() => {
    if (!held) return;

    if (caseRef.current) {
      caseRef.current.rotation.y = wrapAngle(caseRef.current.rotation.y);
    }
    targetY.current = wrapAngle(targetY.current);
  }, [held]);

  useFrame((_, dt) => {
    const c = caseRef.current;
    const p = pivotRef.current;
    if (!c) return;

    if (held) targetY.current = 0;
    c.rotation.y = THREE.MathUtils.damp(c.rotation.y, targetY.current, 8, dt);

    if (p) {
      p.rotation.y =
        place === "case"
          ? c.rotation.y
          : THREE.MathUtils.damp(p.rotation.y, 0, 8, dt);
    }

    const targetLid = isOpen ? LID_OPEN_ANGLE : 0;
    model.lidPivot.rotation.z = THREE.MathUtils.damp(
      model.lidPivot.rotation.z,
      targetLid,
      10,
      dt,
    );
  });

  const pose =
    place === "hand"
      ? s.view === "stereo"
        ? POSE.heldStereo
        : POSE.heldCase
      : place === "tray"
        ? POSE.tray
        : place === "loaded"
          ? POSE.loaded
          : {
              x: 0.1,
              y: 0,
              z: isOpen ? 0.2 : 0.03,
              s: 1,
              tilt: Math.PI / 2,
            };

  const disc = useSpring({ ...pose, config: SPRING });
  const passive = place === "tray" || place === "loaded";

  const onDiscClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 2) return;
    e.stopPropagation();

    if (place === "case") {
      if (s.view === "case" && isOpen) {
        dispatch({
          type: "GRAB",
          albumId: album.id,
          trackCount: album.tracks.length,
        });
      }
    } else if (place === "hand") {
      if (s.view === "case") {
        if (isOpen) dispatch({ type: "RETURN" });
      } else {
        dispatch({ type: "PUT_ON_TRAY" });
      }
    }
  };

  useEffect(() => {
    model.caseDiscGroup.visible = place === "case";
  }, [model, place]);

  return (
    <>
      <group
        ref={caseRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
        }}
        onClick={(e) => {
          if (e.delta > 2) return;
          e.stopPropagation();
          setIsOpen((open) => !open);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <group
          position={model.modelOffset}
          rotation-x={MODEL_ROT_X}
          scale={MODEL_SCALE}
          frustumCulled={false}
        >
          <primitive object={model.root} dispose={null} />
        </group>

        <mesh
          visible={place === "case"}
          position={model.discHitPosition}
          rotation-x={Math.PI / 2}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDiscClick}
        >
          <cylinderGeometry args={[1.2, 1.2, 0.06, 32]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      <group ref={pivotRef}>
        <a.group
          visible={place !== "case"}
          frustumCulled={false}
          position-x={disc.x}
          position-y={disc.y}
          position-z={disc.z}
          scale={disc.s}
          rotation-x={disc.tilt}
          raycast={passive ? NO_RAYCAST : DEFAULT_RAYCAST}
          onPointerDown={(e) => {
            if (place !== "hand") return;
            if (s.view === "case") e.stopPropagation();
          }}
          onClick={onDiscClick}
        >
          <primitive object={model.externalDisc} dispose={null} />
        </a.group>
      </group>
    </>
  );
}

useGLTF.preload(MODEL_URL);

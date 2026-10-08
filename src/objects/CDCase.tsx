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
import type { RackSlot } from "../config/rack";

// Posa a riposo nel rack: custodia sdraiata, copertina in alto, coste (lato cerniera) verso la camera
const RACK_Q = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, "YXZ"),
);
const IDENTITY_Q = new THREE.Quaternion();

const MODEL_URL = "/models/cd_music_02.glb";

// Il GLB contiene 11 custodie: usiamo solo la prima, l'unica con il disco.
// Le sue coordinate locali sono in millimetri, con X = larghezza,
// Y = spessore (+Y = lato copertina) e Z = altezza (+Z = basso).
const CASE_NODE = "CD_CASE.001_6";
const NODES = {
  tray: "Object_12", // vassoio nero
  shell: "Object_14", // base trasparente
  lid: "Object_16", // coperchio trasparente
  front: "Object_10", // booklet frontale (solo per le misure)
  back: "Object_8", // inlay posteriore con le coste (solo per le misure)
  label: "Object_5", // disco, lato stampato
  under: "Object_6", // disco, lato argentato
};

// Millimetri del modello -> unità di scena (custodia larga ~2.8).
const MM = 0.02;
// Nel GLB il coperchio è già aperto di 30° attorno a questa cerniera
// (asse Z locale, misurata confrontandolo con le custodie chiuse del file).
const HINGE_MM = new THREE.Vector2(-66.85, 4.45);
const GLB_LID_ANGLE = THREE.MathUtils.degToRad(30);
// Fondo del vassoio: l'inlay interno va appena sopra, sotto il disco.
const TRAY_FLOOR_MM = 1.75;
// Nell'inlay posteriore le coste occupano il 4.5% a sinistra e a destra.
const SPINE_U = 0.045;

// Apertura a libro: cerniera a sinistra, il coperchio viene verso la camera.
const LID_OPEN_ANGLE = THREE.MathUtils.degToRad(120);

const NO_RAYCAST = () => {};

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

// GLTFLoader ripulisce i nomi ("CD_CASE.001_6" -> "CD_CASE001_6"): confronto normalizzato.
const findMesh = (root: THREE.Object3D, wanted: string) => {
  const target = normalizeName(wanted);
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && normalizeName(o.name) === target) found = o;
  });
  if (!found) throw new Error(`Nodo "${wanted}" non trovato in ${MODEL_URL}`);
  return found;
};

// Quadrilatero con UV; i vertici vanno in senso antiorario visti dal lato visibile.
type Quad = [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];

function quad(corners: Quad, [u0, u1]: [number, number] = [0, 1]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      corners.flatMap((p) => [p.x, p.y, p.z]),
      3,
    ),
  );
  g.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([u0, 0, u1, 0, u1, 1, u0, 1], 2),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const printMaterial = (map: THREE.Texture) =>
  new THREE.MeshBasicMaterial({ map, toneMapped: false });

const configureTexture = (t: THREE.Texture) => {
  if (t.userData.cdConfigured) return;
  t.userData.cdConfigured = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; // le cover sono in dithering
  t.anisotropy = 4;
  t.needsUpdate = true;
};

type Textures = Record<keyof Album["textures"], THREE.Texture>;

type CaseModel = {
  body: THREE.Group; // base + vassoio + stampe, centrata nell'origine
  lid: THREE.Group; // pivot sulla cerniera, ruota su Y
  disc: THREE.Group; // disco centrato, piatto su XZ con l'etichetta verso +Y
  discHome: [number, number, number]; // centro del disco dentro la custodia
  dispose: () => void;
};

function buildCaseModel(scene: THREE.Object3D, tex: Textures): CaseModel {
  const caseNode = findMesh(scene, CASE_NODE);
  scene.updateMatrixWorld(true);
  const toCase = caseNode.matrixWorld.clone().invert();

  // Geometria del nodo espressa in millimetri della custodia (+ trasformazione extra).
  const bake = (name: string, extra = new THREE.Matrix4()) => {
    const mesh = findMesh(caseNode, name) as THREE.Mesh;
    const m = extra.clone().multiply(toCase).multiply(mesh.matrixWorld);
    return { mesh, geometry: mesh.geometry.clone().applyMatrix4(m) };
  };

  // Riporta il coperchio in posizione chiusa.
  const closeLid = new THREE.Matrix4()
    .makeTranslation(HINGE_MM.x, HINGE_MM.y, 0)
    .multiply(new THREE.Matrix4().makeRotationZ(-GLB_LID_ANGLE))
    .multiply(new THREE.Matrix4().makeTranslation(-HINGE_MM.x, -HINGE_MM.y, 0));

  const tray = bake(NODES.tray);
  const shell = bake(NODES.shell);
  const lid = bake(NODES.lid, closeLid);
  const front = bake(NODES.front, closeLid);
  const back = bake(NODES.back);
  const label = bake(NODES.label);
  const under = bake(NODES.under);

  const boxOf = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    return g.boundingBox!.clone();
  };
  const center = boxOf(tray.geometry)
    .union(boxOf(shell.geometry))
    .union(boxOf(lid.geometry))
    .getCenter(new THREE.Vector3());

  // mm della custodia -> scena: fronte verso +Z (camera), alto verso +Y.
  const toScene = new THREE.Matrix4()
    .makeScale(MM, MM, MM)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(
      new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z),
    );
  [tray, shell, lid, front, back].forEach((p) =>
    p.geometry.applyMatrix4(toScene),
  );

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const meshOf = (g: THREE.BufferGeometry, m: THREE.Material) =>
    new THREE.Mesh(track(g), track(m));

  const black = track(
    new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.55 }),
  );
  const plastic = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const clear = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(track(g), plastic);
    m.raycast = NO_RAYCAST; // i click passano alle stampe e al disco
    m.renderOrder = 1;
    return m;
  };

  // --- Corpo: vassoio, base trasparente, inlay posteriore e interno.
  const body = new THREE.Group();
  body.add(new THREE.Mesh(track(tray.geometry), black));
  body.add(clear(shell.geometry));

  const bb = boxOf(back.geometry);
  const zb = bb.min.z - 0.002; // appena dietro il vassoio
  const zs = bb.max.z;
  const backTex = printMaterial(tex.back);
  // Retro visto da dietro: la sinistra dell'immagine sta su +X.
  body.add(
    meshOf(
      quad(
        [
          v3(bb.max.x, bb.min.y, zb),
          v3(bb.min.x, bb.min.y, zb),
          v3(bb.min.x, bb.max.y, zb),
          v3(bb.max.x, bb.max.y, zb),
        ],
        [SPINE_U, 1 - SPINE_U],
      ),
      backTex,
    ),
    meshOf(
      quad(
        [
          v3(bb.min.x, bb.min.y, zb),
          v3(bb.min.x, bb.min.y, zs),
          v3(bb.min.x, bb.max.y, zs),
          v3(bb.min.x, bb.max.y, zb),
        ],
        [1 - SPINE_U, 1],
      ),
      backTex,
    ),
    meshOf(
      quad(
        [
          v3(bb.max.x, bb.min.y, zs),
          v3(bb.max.x, bb.min.y, zb),
          v3(bb.max.x, bb.max.y, zb),
          v3(bb.max.x, bb.max.y, zs),
        ],
        [0, SPINE_U],
      ),
      backTex,
    ),
  );

  const zi = (TRAY_FLOOR_MM - center.y) * MM;
  body.add(
    meshOf(
      quad([
        v3(bb.min.x, bb.min.y, zi),
        v3(bb.max.x, bb.min.y, zi),
        v3(bb.max.x, bb.max.y, zi),
        v3(bb.min.x, bb.max.y, zi),
      ]),
      printMaterial(tex.inside),
    ),
  );

  // --- Coperchio: tutto in coordinate relative alla cerniera.
  const hinge = new THREE.Vector3(HINGE_MM.x, HINGE_MM.y, center.z)
    .applyMatrix4(toScene)
    .setY(0);
  const lidGroup = new THREE.Group();
  lidGroup.position.copy(hinge);
  const fb = boxOf(front.geometry).translate(hinge.clone().negate());
  const zf = fb.max.z;
  lidGroup.add(
    clear(lid.geometry.translate(-hinge.x, -hinge.y, -hinge.z)),
    meshOf(
      quad([
        v3(fb.min.x, fb.min.y, zf),
        v3(fb.max.x, fb.min.y, zf),
        v3(fb.max.x, fb.max.y, zf),
        v3(fb.min.x, fb.max.y, zf),
      ]),
      printMaterial(tex.front),
    ),
    // retro del booklet, visibile a custodia aperta
    meshOf(
      quad([
        v3(fb.max.x, fb.min.y, zf - 0.002),
        v3(fb.min.x, fb.min.y, zf - 0.002),
        v3(fb.min.x, fb.max.y, zf - 0.002),
        v3(fb.max.x, fb.max.y, zf - 0.002),
      ]),
      new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.9 }),
    ),
  );
  front.geometry.dispose();
  back.geometry.dispose();

  // --- Disco: assi della custodia (etichetta verso +Y), centrato e in scala.
  const lb = boxOf(label.geometry);
  const discCenter = lb.getCenter(new THREE.Vector3());
  const radius = Math.max(lb.max.x - lb.min.x, lb.max.z - lb.min.z) / 2;
  const toDisc = new THREE.Matrix4()
    .makeScale(MM, MM, MM)
    .multiply(
      new THREE.Matrix4().makeTranslation(
        -discCenter.x,
        -discCenter.y,
        -discCenter.z,
      ),
    );
  label.geometry.applyMatrix4(toDisc);
  under.geometry.applyMatrix4(toDisc);

  // Le UV originali puntano a un atlas: proiezione planare dall'alto.
  const pos = label.geometry.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  const r = radius * MM;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = 0.5 + pos.getX(i) / (2 * r);
    uv[i * 2 + 1] = 0.5 - pos.getZ(i) / (2 * r);
  }
  label.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const disc = new THREE.Group();
  disc.add(
    meshOf(
      label.geometry,
      new THREE.MeshStandardMaterial({
        map: tex.disk,
        roughness: 0.4,
        metalness: 0.1,
      }),
    ),
    meshOf(
      under.geometry,
      new THREE.MeshStandardMaterial({
        color: 0xd4d8de,
        roughness: 0.25,
        metalness: 0.5,
      }),
    ),
    // Hitbox invisibile: il mozzo del vassoio sporge dal foro e ruberebbe i click
    meshOf(
      new THREE.CylinderGeometry(r, r, 0.08, 32).translate(0, 0.02, 0),
      new THREE.MeshBasicMaterial({ visible: false }),
    ),
  );

  const home = discCenter.applyMatrix4(toScene);

  return {
    body,
    lid: lidGroup,
    disc,
    discHome: [home.x, home.y, home.z],
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

export function CDCase({ album, slot }: { album: Album; slot: RackSlot }) {
  const s = useGameState();
  const dispatch = useGameDispatch();
  const [isOpen, setIsOpen] = useState(false);

  const tex = useTexture(album.textures);
  const { scene } = useGLTF(MODEL_URL);

  const model = useMemo(() => {
    Object.values(tex).forEach(configureTexture);
    return buildCaseModel(scene, tex);
  }, [scene, tex]);
  useEffect(() => () => model.dispose(), [model]);

  const place = placeOf(s, album.id);
  const held = place === "hand";
  const selected = s.selectedId === album.id;
  const rotatable = s.view === "case" && !held && selected;
  const passive = place === "tray" || place === "loaded"; // ci pensa la hitbox del vassoio

  const caseRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const targetY = useRef(0);
  const dragging = useRef(false);
  const rotatableRef = useRef(rotatable);
  rotatableRef.current = rotatable;
  const openRef = useRef(isOpen);
  openRef.current = isOpen;

  const mountRef = useRef<THREE.Group>(null); // posa della custodia (rack <-> centro)
  const discMountRef = useRef<THREE.Group>(null); // il disco la segue solo finché è nella custodia
  const lift = useRef(selected ? 1 : 0);
  const hover = useRef({ target: 0, value: 0 });

  useEffect(() => {
    if (!selected) setIsOpen(false);
  }, [selected]);

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

  // Presa del disco: elimino i giri completi, la custodia torna a 0 per la via più breve
  useEffect(() => {
    if (!held) return;
    if (caseRef.current)
      caseRef.current.rotation.y = wrapAngle(caseRef.current.rotation.y);
    targetY.current = wrapAngle(targetY.current);
  }, [held]);

  // Apertura: riporto l'angolo nel range consentito
  useEffect(() => {
    if (!isOpen) return;
    if (caseRef.current)
      caseRef.current.rotation.y = wrapAngle(caseRef.current.rotation.y);
    targetY.current = THREE.MathUtils.clamp(
      wrapAngle(targetY.current),
      OPEN_ROT_MIN,
      OPEN_ROT_MAX,
    );
  }, [isOpen]);

  // Il disco sul vassoio/caricato non deve intercettare i click
  useEffect(() => {
    model.disc.traverse((o) => {
      if (o instanceof THREE.Mesh)
        o.raycast = passive ? NO_RAYCAST : THREE.Mesh.prototype.raycast;
    });
  }, [model, passive]);

  useFrame((_, dt) => {
    const c = caseRef.current,
      p = pivotRef.current;
    if (!c) return;
    if (held) targetY.current = 0;
    c.rotation.y = THREE.MathUtils.damp(c.rotation.y, targetY.current, 8, dt);
    if (p)
      p.rotation.y =
        place === "case"
          ? c.rotation.y
          : THREE.MathUtils.damp(p.rotation.y, 0, 8, dt);
    model.lid.rotation.y = THREE.MathUtils.damp(
      model.lid.rotation.y,
      isOpen ? -LID_OPEN_ANGLE : 0,
      8,
      dt,
    );
  });

  useFrame((_, dt) => {
    const m = mountRef.current,
      d = discMountRef.current;
    if (!m || !d) return;
    const goal = selected ? 1 : 0;
    lift.current = THREE.MathUtils.damp(lift.current, goal, 6, dt);
    if (Math.abs(lift.current - goal) < 0.001) lift.current = goal;
    const h = hover.current;
    h.value = THREE.MathUtils.damp(h.value, selected ? 0 : h.target, 14, dt);

    const t = lift.current,
      arc = Math.sin(Math.PI * t),
      L = THREE.MathUtils.lerp;
    m.position.set(
      L(slot.position[0], 0, t),
      L(slot.position[1], 0, t) + arc * 0.4,
      L(slot.position[2] + h.value * slot.hover, 0, t) + arc * 1.2, // esce in avanti prima di salire
    );
    m.quaternion.slerpQuaternions(RACK_Q, IDENTITY_Q, t);
    m.scale.setScalar(L(slot.scale, 1, t));

    if (place === "case") {
      d.position.copy(m.position);
      d.quaternion.copy(m.quaternion);
      d.scale.copy(m.scale);
    } else {
      // in mano / vassoio / stereo: coordinate mondo
      d.position.set(0, 0, 0);
      d.quaternion.identity();
      d.scale.set(1, 1, 1);
    }
  });

  const [hx, hy, hz] = model.discHome;
  const pose =
    place === "hand"
      ? s.view === "stereo"
        ? POSE.heldStereo
        : POSE.heldCase
      : place === "tray"
        ? POSE.tray
        : place === "loaded"
          ? POSE.loaded
          : { x: hx, y: hy, z: hz, s: 1, tilt: Math.PI / 2 };
  const disc = useSpring({ ...pose, config: SPRING });

  const onDiscClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 2) return;
    e.stopPropagation();
    if (place === "case") {
      if (!selected) {
        dispatch({ type: "SELECT_ALBUM", albumId: album.id });
        return;
      }
      if (s.view === "case" && isOpen)
        dispatch({
          type: "GRAB",
          albumId: album.id,
          trackCount: album.tracks.length,
        });
    } else if (place === "hand") {
      if (s.view === "case") {
        if (isOpen) dispatch({ type: "RETURN" });
      } else dispatch({ type: "PUT_ON_TRAY" });
    }
  };

  const pointer = {
    onPointerOver: () => {
      hover.current.target = 1;
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      hover.current.target = 0;
      document.body.style.cursor = "auto";
    },
  };

  return (
    <>
      <group ref={mountRef}>
        <group
          ref={caseRef}
          onPointerDown={(e) => {
            if (!selected) return;
            e.stopPropagation();
            dragging.current = true;
          }}
          onClick={(e) => {
            if (e.delta > 2) return;
            e.stopPropagation();
            if (!selected)
              dispatch({ type: "SELECT_ALBUM", albumId: album.id });
            else setIsOpen((o) => !o);
          }}
          {...pointer}
        >
          <primitive object={model.body} />
          <primitive object={model.lid} />
        </group>
      </group>

      <group ref={discMountRef}>
        <group ref={pivotRef}>
          <a.group
            position-x={disc.x}
            position-y={disc.y}
            position-z={disc.z}
            scale={disc.s}
            rotation-x={disc.tilt}
            onPointerDown={(e) => {
              if (place === "case") {
                if (!selected) return;
                e.stopPropagation();
                dragging.current = true;
              } else if (place === "hand" && s.view === "case")
                e.stopPropagation();
            }}
            onClick={onDiscClick}
            {...(passive ? {} : pointer)}
          >
            <primitive object={model.disc} />
          </a.group>
        </group>
      </group>
    </>
  );
}

useGLTF.preload(MODEL_URL);

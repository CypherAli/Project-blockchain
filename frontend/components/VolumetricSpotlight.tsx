'use client';
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ── GLSL shaders ── */
const VERT = `
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3  uColor;
  varying vec3  vPosition;
  varying vec2  vUv;

  float random(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  void main() {
    float distFromCenter = length(vUv - 0.5) * 2.0;
    float heightFade     = 1.0 - vPosition.y;
    float edge           = 1.0 - smoothstep(0.3, 1.0, distFromCenter);

    vec3  dustPos = vPosition * 8.0 + vec3(uTime * 0.05, uTime * 0.04, uTime * 0.06);
    float dust1   = random(floor(dustPos));
    float dust2   = random(floor(dustPos * 2.0 + 1.3));
    float dust3   = random(floor(dustPos * 4.0 + 2.7));
    float dust    = dust1 * 0.5 + dust2 * 0.3 + dust3 * 0.2;

    float alpha      = edge * heightFade * uIntensity;
    alpha           += dust * 0.15 * edge * heightFade;
    vec3  finalColor = uColor * (0.8 + dust * 0.4);

    gl_FragColor = vec4(finalColor, alpha * 0.35);
  }
`;

/* ── Volumetric cone ── */
function SpotCone() {
  const meshRef = useRef<THREE.Mesh>(null);
  const shader  = useMemo(() => ({
    uniforms: {
      uTime:      { value: 0 },
      uIntensity: { value: 1.0 },
      uColor:     { value: new THREE.Color(0xfff8b4) },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
  }), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.ShaderMaterial;
    if (mat.uniforms) mat.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} position={[0, 2.5, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[1.8, 4.5, 32, 32, true]} />
      <shaderMaterial
        args={[shader]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Brownian dust particles ── */
function DustParticles({ count = 120 }: { count?: number }) {
  const ref  = useRef<THREE.Points>(null);
  const data = useMemo(() =>
    Array.from({ length: count }, () => ({
      x:     (Math.random() - 0.5) * 2.5,
      y:     Math.random() * 4.5,
      z:     (Math.random() - 0.5) * 2.5,
      speed: 0.001 + Math.random() * 0.002,
    })),
  [count]);

  const initPos = useMemo(
    () => new Float32Array(data.flatMap(p => [p.x, p.y, p.z])),
    [data],
  );

  useFrame(() => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    data.forEach((p, i) => {
      p.y -= p.speed;
      p.x += (Math.random() - 0.5) * 0.008;
      p.z += (Math.random() - 0.5) * 0.008;
      if (p.y < 0) p.y = 4.5;
      arr[i * 3]     = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[initPos, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#fff8b4"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

/* ── Main export ── */
export default function VolumetricSpotlight() {
  return (
    <div
      style={{
        position:      'absolute',
        top:           -140,
        left:          '50%',
        transform:     'translateX(-50%)',
        width:         500,
        height:        600,
        pointerEvents: 'none',
        zIndex:        1,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 35 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.1} />
        <SpotCone />
        <DustParticles />
      </Canvas>
    </div>
  );
}

import React, { useRef, useMemo, Suspense, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { TextureLoader, Mesh, ShaderMaterial, BackSide } from 'three'
import { getEarthRadius } from '../../utils/orbitalCalculations'

interface EarthContentProps {
  currentTime: Date
}

const EarthContent: React.FC<EarthContentProps> = ({ currentTime }) => {
  const meshRef = useRef<Mesh>(null)
  const atmosphereRef = useRef<Mesh>(null)
  const cloudsRef = useRef<Mesh>(null)

  const earthRadius = getEarthRadius()

  // Load textures from CDN
  const [dayTexture, nightTexture, cloudsTexture] = useLoader(TextureLoader, [
    'https://unpkg.com/three-globe@2.31.1/example/img/earth-day.jpg',
    'https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg',
    'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png',
  ])

  // Earth rotation synced to timeline
  // Earth rotates once every 24 hours (86400000 milliseconds)
  useEffect(() => {
    if (meshRef.current) {
      const millisecondsSinceMidnight = currentTime.getTime() % 86400000
      const rotationAngle = (millisecondsSinceMidnight / 86400000) * Math.PI * 2
      meshRef.current.rotation.y = rotationAngle
    }
    if (cloudsRef.current) {
      const millisecondsSinceMidnight = currentTime.getTime() % 86400000
      // Clouds rotate slightly faster
      const rotationAngle = (millisecondsSinceMidnight / 86400000) * Math.PI * 2 * 1.2
      cloudsRef.current.rotation.y = rotationAngle
    }
  }, [currentTime])

  // Atmosphere shader material
  const atmosphereMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
          }
        `,
        transparent: true,
        side: BackSide,
      }),
    []
  )

  // Custom shader for day/night blending
  const earthMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTexture },
          nightTexture: { value: nightTexture },
          sunDirection: { value: [1, 0, 0] }, // Sun direction
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          
          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D dayTexture;
          uniform sampler2D nightTexture;
          uniform vec3 sunDirection;
          
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          
          void main() {
            vec3 dayColor = texture2D(dayTexture, vUv).rgb;
            vec3 nightColor = texture2D(nightTexture, vUv).rgb;
            
            // Calculate how much this fragment is facing the sun
            vec3 normal = normalize(vNormal);
            vec3 sunDir = normalize(sunDirection);
            float sunIntensity = dot(normal, sunDir);
            
            // Create smooth transition from day to night
            float mixValue = smoothstep(-0.1, 0.2, sunIntensity);
            
            // Blend day and night textures
            vec3 color = mix(nightColor * 2.0, dayColor, mixValue);
            
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [dayTexture, nightTexture]
  )

  return (
    <group>
      {/* Main Earth sphere with day/night textures */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[earthRadius, 128, 128]} />
        <primitive object={earthMaterial} attach="material" />
      </mesh>

      {/* Cloud layer with texture */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[earthRadius * 1.01, 64, 64]} />
        <meshStandardMaterial map={cloudsTexture} transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef} scale={1.15}>
        <sphereGeometry args={[earthRadius, 64, 64]} />
        <primitive object={atmosphereMaterial} attach="material" />
      </mesh>
    </group>
  )
}

// Fallback Earth component (used while loading or on error)
const FallbackEarth: React.FC<EarthContentProps> = ({ currentTime }) => {
  const meshRef = useRef<Mesh>(null)
  const cloudsRef = useRef<Mesh>(null)
  const earthRadius = getEarthRadius()

  // Earth rotation synced to timeline
  useEffect(() => {
    if (meshRef.current) {
      const millisecondsSinceMidnight = currentTime.getTime() % 86400000
      const rotationAngle = (millisecondsSinceMidnight / 86400000) * Math.PI * 2
      meshRef.current.rotation.y = rotationAngle
    }
    if (cloudsRef.current) {
      const millisecondsSinceMidnight = currentTime.getTime() % 86400000
      const rotationAngle = (millisecondsSinceMidnight / 86400000) * Math.PI * 2 * 1.2
      cloudsRef.current.rotation.y = rotationAngle
    }
  }, [currentTime])

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[earthRadius, 64, 64]} />
        <meshStandardMaterial color="#2563eb" roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[earthRadius * 1.01, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  )
}

interface EarthProps {
  currentTime: Date
}

const Earth: React.FC<EarthProps> = ({ currentTime }) => {
  return (
    <Suspense fallback={<FallbackEarth currentTime={currentTime} />}>
      <EarthContent currentTime={currentTime} />
    </Suspense>
  )
}

export default Earth

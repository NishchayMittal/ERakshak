import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { ArrowRight } from "lucide-react";

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

// ── THREE.JS EARTH EFFECT BACKGROUND ──
type EarthEffectProps = {
  className?: string;
  style?: React.CSSProperties;
};

function EarthEffect({ className, style }: EarthEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameIdRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0006);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      10000,
    );
    const baseCameraZ = 1100;
    camera.position.set(0, 0, baseCameraZ);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);

    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 1. Globe Background Sphere
    const radius = 350;
    const baseGeo = new THREE.SphereGeometry(radius - 2, 64, 64);
    const baseMat = new THREE.MeshBasicMaterial({
      color: 0x080012,
      transparent: true,
      opacity: 0.95,
    });
    const baseSphere = new THREE.Mesh(baseGeo, baseMat);
    globeGroup.add(baseSphere);

    // 2. Dotted Continents
    const positions: number[] = [];
    const colors: number[] = [];
    const phiSteps = 100;
    const thetaSteps = 200;

    for (let i = 0; i <= phiSteps; i++) {
      const phi = (Math.PI * i) / phiSteps;
      for (let j = 0; j <= thetaSteps; j++) {
        const theta = (2 * Math.PI * j) / thetaSteps;
        const noise =
          Math.sin(3 * phi) * Math.cos(4 * theta) +
          Math.sin(6 * phi) * Math.sin(2 * theta) +
          Math.cos(5 * phi) * Math.cos(5 * theta);

        if (noise > 0.1) continue;

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        positions.push(x, y, z);

        const mix = Math.random();
        if (mix > 0.8) {
          colors.push(0.8, 0.9, 1.0);
        } else if (mix > 0.4) {
          colors.push(0.7, 0.2, 1.0);
        } else {
          colors.push(0.5, 0.2, 0.9);
        }
      }
    }

    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    dotGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const dotMat = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });

    const dotGlobe = new THREE.Points(dotGeo, dotMat);
    globeGroup.add(dotGlobe);

    // 3. Glowing Atmosphere Aura
    const auraGeo = new THREE.SphereGeometry(radius + 15, 64, 64);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x6b21a8,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auraSphere = new THREE.Mesh(auraGeo, auraMat);
    globeGroup.add(auraSphere);

    // 4. Orbital Rings
    const ringGeo = new THREE.RingGeometry(radius + 60, radius + 62, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = Math.PI / 8;
    globeGroup.add(ring);

    const ringGeo2 = new THREE.RingGeometry(radius + 50, radius + 72, 128);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x6b21a8,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = Math.PI / 2;
    ring2.rotation.y = Math.PI / 8;
    globeGroup.add(ring2);

    // 5. Data Arcs (Threat Map)
    const arcsGroup = new THREE.Group();
    globeGroup.add(arcsGroup);

    const getRandomSpherePoint = (r: number) => {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    const movingParticles: any[] = [];

    for (let i = 0; i < 8; i++) {
      const p1 = getRandomSpherePoint(radius);
      const p2 = getRandomSpherePoint(radius);
      const mid = p1
        .clone()
        .add(p2)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(radius + 40 + Math.random() * 60);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const points = curve.getPoints(50);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
      const curveMat = new THREE.LineBasicMaterial({
        color: 0x00ffc2,
        transparent: true,
        opacity: 0.15 + Math.random() * 0.2,
        blending: THREE.AdditiveBlending,
      });
      const arc = new THREE.Line(curveGeo, curveMat);
      arcsGroup.add(arc);

      const particleGeo = new THREE.SphereGeometry(2.5, 8, 8);
      const particleMat = new THREE.MeshBasicMaterial({
        color: 0x00ffc2,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      arcsGroup.add(particle);

      movingParticles.push({
        mesh: particle,
        curve: curve,
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.008,
      });
    }

    // 6. Background Stars / Particles
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    const starColors = [];
    for (let i = 0; i < 600; i++) {
      starPos.push(
        (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 3000 - 500,
      );
      starColors.push(
        0.6 + Math.random() * 0.4,
        0.4 + Math.random() * 0.6,
        1.0,
      );
    }
    starGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPos, 3),
    );
    starGeo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(starColors, 3),
    );
    const starMat = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    globeGroup.position.y = -20;
    globeGroup.rotation.z = Math.PI / 16;

    // Mouse Move Listener for Parallax
    const onMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX - window.innerWidth / 2;
      mouseY = event.clientY - window.innerHeight / 2;
      targetX = mouseX * 0.15;
      targetY = mouseY * 0.15;
    };
    window.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      if (isCancelled) return;

      animationFrameIdRef.current = requestAnimationFrame(animate);

      // Smooth Parallax
      camera.position.x += (targetX - camera.position.x) * 0.02;
      camera.position.y += (-targetY - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      // Spin globe
      globeGroup.rotation.y += 0.0015;

      // Rotate stars slowly
      stars.rotation.y -= 0.0002;
      stars.rotation.x -= 0.0001;

      // Animate particles
      movingParticles.forEach((p) => {
        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          p.speed = 0.003 + Math.random() * 0.008;
        }
        const pos = p.curve.getPoint(p.t);
        p.mesh.position.copy(pos);
      });

      renderer.render(scene, camera);
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      isCancelled = true;
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animationFrameIdRef.current);

      scene.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m: any) => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background:
          "radial-gradient(circle at center, #1a052a 0%, #000000 80%)",
        ...style,
      }}
    />
  );
}

// ── PORTAL PAGE RENDERER ──
export default function PortalPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000000",
        color: "#ffffff",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {/* Three.js Holographic Background */}
      <EarthEffect />

      {/* HUD Scanline Overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 5,
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)",
          opacity: 0.5,
        }}
      />

      {/* Edge Vignette */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 6,
          boxShadow: "inset 0 0 150px rgba(0,0,0,0.9)",
        }}
      />

      {/* Brand Header */}
      <div
        style={{
          position: "absolute",
          top: "30px",
          zIndex: 10,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--accent-primary)",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            textShadow: "0 0 10px rgba(0,255,194,0.4)",
          }}
        >
          ORION
        </h1>
        <p
          style={{
            margin: "4px 0 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            color: "var(--text-muted)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Active Workspace Orbital Gateway
        </p>
      </div>

      {/* Centered Dashboard Button */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          background: "rgba(8,12,16,0.6)",
          padding: "40px",
          borderRadius: "16px",
          border: "1px solid rgba(0,255,194,0.2)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              margin: "0 0 8px 0",
              fontSize: "24px",
              fontWeight: 300,
              letterSpacing: "0.1em",
              color: "var(--text-primary)",
            }}
          >
            SYSTEM ONLINE
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
            }}
          >
            Secure connection established.
          </p>
        </div>
        <button
          onClick={() => navigate("/login")}
          style={{
            background: "rgba(0, 255, 194, 0.1)",
            border: "1px solid var(--accent-primary)",
            color: "var(--accent-primary)",
            fontFamily: "var(--font-heading)",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "16px 32px",
            cursor: "pointer",
            boxShadow: "0 0 16px rgba(0,255,194,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            transition: "all 0.3s ease",
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-primary)";
            e.currentTarget.style.color = "#000000";
            e.currentTarget.style.boxShadow = "0 0 32px rgba(0,255,194,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0, 255, 194, 0.1)";
            e.currentTarget.style.color = "var(--accent-primary)";
            e.currentTarget.style.boxShadow = "0 0 16px rgba(0,255,194,0.25)";
          }}
        >
          <span>ENTER DASHBOARD</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

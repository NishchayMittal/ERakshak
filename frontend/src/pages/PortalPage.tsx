import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { ArrowRight } from 'lucide-react';
import { CyberCard } from '../components/ui/CyberCard';
import { CyberButton } from '../components/ui/CyberButton';


// ── THREE.JS EARTH EFFECT BACKGROUND ──
function EarthEffect() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameIdRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let isZooming = false;

    // Raycaster for interactive nodes
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-1000, -1000); 

    // Tooltip DOM element
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.padding = '8px 12px';
    tooltip.style.background = 'rgba(8,12,16,0.9)';
    tooltip.style.border = '1px solid #39FF14';
    tooltip.style.color = '#39FF14';
    tooltip.style.fontFamily = 'monospace';
    tooltip.style.fontSize = '10px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';
    tooltip.style.zIndex = '100';
    tooltip.style.boxShadow = '0 0 10px rgba(57,255,20,0.3)';
    tooltip.style.borderRadius = '4px';
    tooltip.style.textTransform = 'uppercase';
    document.body.appendChild(tooltip);

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0006);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      10000
    );
    const baseCameraZ = 1100;
    camera.position.set(0, 0, baseCameraZ);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0'; 

    containerRef.current.innerHTML = '';
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
        
        // Deep purple variants for the map dots
        const mix = Math.random();
        if (mix > 0.8) {
           colors.push(0.8, 0.4, 1.0); // light purple
        } else if (mix > 0.4) {
           colors.push(0.6, 0.2, 0.9); // mid purple
        } else {
           colors.push(0.4, 0.1, 0.7); // dark purple
        }
      }
    }

    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    dotGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const dotMat = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending, 
    });

    const dotGlobe = new THREE.Points(dotGeo, dotMat);
    globeGroup.add(dotGlobe);

    // 3. True Radial Glowing Perimeter Aura (Always facing camera)
    const perimeterGeo = new THREE.RingGeometry(radius, radius + 2, 128);
    const perimeterMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const perimeterMesh = new THREE.Mesh(perimeterGeo, perimeterMat);
    
    // Smooth shader glow
    const glowGeo = new THREE.RingGeometry(radius, radius + 45, 128);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xc084fc) }, // bright purple
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          // vUv.y goes from 0 at inner radius to 1 at outer radius
          float alpha = 1.0 - vUv.y;
          alpha = pow(alpha, 2.5); // exponential falloff for soft glow
          gl_FragColor = vec4(color, alpha * 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);

    // Make the rings always face the camera to create a persistent 2D halo
    const updateHaloRotation = (mesh: THREE.Mesh) => {
      mesh.onBeforeRender = (renderer, scene, camera) => {
        mesh.quaternion.copy(camera.quaternion);
      };
    };
    updateHaloRotation(perimeterMesh);
    updateHaloRotation(glowMesh);

    scene.add(perimeterMesh);
    scene.add(glowMesh);

    // 4. Orbital Rings (Tilted)
    const ringGeo = new THREE.RingGeometry(radius + 70, radius + 73, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc, // bright purple
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = Math.PI / 8;
    globeGroup.add(ring);
    
    const ringGeo2 = new THREE.RingGeometry(radius + 90, radius + 115, 128);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = Math.PI / 2;
    ring2.rotation.y = -Math.PI / 12;
    globeGroup.add(ring2);

    // 5. Interactive Threat Nodes
    const interactiveNodes: THREE.Mesh[] = [];
    const nodeLabels = [
      "Threat Detected: Sector 4",
      "Origin: Server 0x4A",
      "Anomaly: Data Exfil",
      "Node: Active Intercept",
      "Alert: Unauthorized Access"
    ];

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

    for(let i=0; i<5; i++) {
      const pos = getRandomSpherePoint(radius + 2);
      const nodeGeo = new THREE.SphereGeometry(8, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: 0xd8b4fe, // very light purple
        transparent: true,
        opacity: 0.9,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.copy(pos);
      nodeMesh.userData = { label: nodeLabels[i] };
      globeGroup.add(nodeMesh);
      interactiveNodes.push(nodeMesh);

      // Pulsing ring around node
      const ringGeo = new THREE.RingGeometry(12, 14, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(new THREE.Vector3(0,0,0)); // face outwards
      globeGroup.add(ringMesh);
    }

    // 6. Data Arcs
    const arcsGroup = new THREE.Group();
    globeGroup.add(arcsGroup);
    
    const movingParticles: any[] = [];
    for(let i=0; i<8; i++) {
      const p1 = getRandomSpherePoint(radius);
      const p2 = getRandomSpherePoint(radius);
      const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(radius + 40 + Math.random() * 60);
      
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const points = curve.getPoints(50);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
      const curveMat = new THREE.LineBasicMaterial({ 
        color: 0xa855f7, 
        transparent: true, 
        opacity: 0.2 + Math.random() * 0.3,
        blending: THREE.AdditiveBlending 
      });
      const arc = new THREE.Line(curveGeo, curveMat);
      arcsGroup.add(arc);
      
      const particleGeo = new THREE.SphereGeometry(3, 8, 8);
      const particleMat = new THREE.MeshBasicMaterial({
        color: 0xe9d5ff, // nearly white purple
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      arcsGroup.add(particle);
      
      movingParticles.push({
        mesh: particle,
        curve: curve,
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.008
      });
    }

    // 7. Background Stars & Orion Constellation
    const starsGroup = new THREE.Group();
    scene.add(starsGroup);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    const starColors = [];
    
    // generate random stars
    for (let i = 0; i < 800; i++) {
      starPos.push(
        (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 3000 - 500
      );
      starColors.push(0.4, 0.2, 0.6 + Math.random() * 0.4); // faint purple/blue
    }
    
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    starsGroup.add(stars);

    // Hardcode Orion constellation in background
    const orionStars = [
      new THREE.Vector3(-200, 300, -800), // Betelgeuse
      new THREE.Vector3(200, 250, -800),  // Bellatrix
      new THREE.Vector3(-50, 0, -800),    // Alnitak (Belt)
      new THREE.Vector3(0, -20, -800),    // Alnilam (Belt)
      new THREE.Vector3(50, -40, -800),   // Mintaka (Belt)
      new THREE.Vector3(-150, -300, -800),// Saiph
      new THREE.Vector3(250, -250, -800)  // Rigel
    ];
    
    const orionLines = [
      [0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]
    ];

    const constellationGeo = new THREE.BufferGeometry();
    const constellationPoints: number[] = [];
    orionLines.forEach(line => {
      const p1 = orionStars[line[0]];
      const p2 = orionStars[line[1]];
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      mid.z -= 50; 
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      curve.getPoints(20).forEach(pt => constellationPoints.push(pt.x, pt.y, pt.z));
    });
    constellationGeo.setAttribute('position', new THREE.Float32BufferAttribute(constellationPoints, 3));
    const constellationMat = new THREE.LineBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });
    const constellation = new THREE.Line(constellationGeo, constellationMat);
    starsGroup.add(constellation);

    const orionStarsGeo = new THREE.BufferGeometry().setFromPoints(orionStars);
    const orionStarsMat = new THREE.PointsMaterial({
      color: 0xc084fc,
      size: 8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    starsGroup.add(new THREE.Points(orionStarsGeo, orionStarsMat));

    globeGroup.position.y = -20;
    globeGroup.rotation.z = Math.PI / 16; 

    // Mouse Move Listener
    const onMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2);
      mouseY = (event.clientY - window.innerHeight / 2);
      targetX = mouseX * 0.15;
      targetY = mouseY * 0.15;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      tooltip.style.left = `${event.clientX + 15}px`;
      tooltip.style.top = `${event.clientY + 15}px`;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Zoom Event Listener
    const onTriggerZoom = () => {
      isZooming = true;
    };
    window.addEventListener('trigger-zoom', onTriggerZoom);

    const animate = () => {
      if (isCancelled) return;

      animationFrameIdRef.current = requestAnimationFrame(animate);

      if (isZooming) {
        camera.position.z += (50 - camera.position.z) * 0.08;
        camera.position.x += (0 - camera.position.x) * 0.08;
        camera.position.y += (0 - camera.position.y) * 0.08;
        
        if (camera.position.z < 100) {
          window.dispatchEvent(new Event('zoom-complete'));
          isZooming = false; 
        }
      } else {
        camera.position.x += (targetX - camera.position.x) * 0.02;
        camera.position.y += (-targetY - camera.position.y) * 0.02;
      }
      camera.lookAt(scene.position);
      
      // Update perimeter halo position to match globe group Y offset
      perimeterMesh.position.copy(globeGroup.position);
      glowMesh.position.copy(globeGroup.position);

      globeGroup.rotation.y += 0.0015;
      starsGroup.rotation.y -= 0.0002;
      starsGroup.rotation.x -= 0.0001;
      
      movingParticles.forEach(p => {
        p.t += p.speed;
        if(p.t > 1) {
          p.t = 0;
          p.speed = 0.003 + Math.random() * 0.008;
        }
        const pos = p.curve.getPoint(p.t);
        p.mesh.position.copy(pos);
      });

      if (!isZooming) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactiveNodes);
        
        if (intersects.length > 0) {
          const hovered = intersects[0].object;
          tooltip.innerText = hovered.userData.label;
          tooltip.style.opacity = '1';
          document.body.style.cursor = 'crosshair';
        } else {
          tooltip.style.opacity = '0';
          document.body.style.cursor = 'default';
        }
      } else {
        tooltip.style.opacity = '0';
      }

      renderer.render(scene, camera);
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('trigger-zoom', onTriggerZoom);
      cancelAnimationFrame(animationFrameIdRef.current);

      if (document.body.contains(tooltip)) {
        document.body.removeChild(tooltip);
      }
      document.body.style.cursor = 'default';

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
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, #10001a 0%, #000000 80%)',
      }}
    />
  );
}

// ── PORTAL PAGE RENDERER ──
export default function PortalPage() {
  const navigate = useNavigate();
  const [isZooming, setIsZooming] = useState(false);

  useEffect(() => {
    const handleZoomComplete = () => {
      navigate('/login');
    };
    window.addEventListener('zoom-complete', handleZoomComplete);
    return () => window.removeEventListener('zoom-complete', handleZoomComplete);
  }, [navigate]);

  const handleEnterClick = () => {
    setIsZooming(true);
    window.dispatchEvent(new Event('trigger-zoom'));
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <EarthEffect />
      
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          zIndex: 5,
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
          opacity: 0.5,
          transition: 'opacity 1s',
        }}
      />
      
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          zIndex: 6,
          boxShadow: 'inset 0 0 150px rgba(0,0,0,0.9)',
        }}
      />
      
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.12,
          background: 'linear-gradient(180deg, transparent 0%, rgba(57,255,20,0.2) 50%, transparent 100%)',
          backgroundSize: '100% 200%',
          animation: 'matrixRain 4s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes matrixRain {
            0% { background-position: 0% -200%; }
            100% { background-position: 0% 200%; }
          }
        `}
      </style>

      <div
        style={{
          position: 'absolute',
          top: '30px',
          zIndex: 10,
          textAlign: 'center',
          pointerEvents: 'none',
          opacity: isZooming ? 0 : 1,
          transition: 'opacity 0.5s ease',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-heading)',
            fontSize: '18px',
            fontWeight: 700,
            color: '#39ff14',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(57,255,20,0.4)',
          }}
        >
          ORION
        </h1>
        <p
          style={{
            margin: '4px 0 0 0',
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Active Workspace Orbital Gateway
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          zIndex: 10,
          width: '280px',
          height: '140px',
          background: 'rgba(8,12,16,0.7)',
          border: '1px solid rgba(57,255,20,0.2)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#39ff14',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
          opacity: isZooming ? 0 : 1,
          transition: 'opacity 0.5s ease',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(57,255,20,0.2)', paddingBottom: '4px', marginBottom: '8px', color: '#6E7681' }}>
          <span>TERMINAL</span>
          <span>//</span>
          <span>SYS.LOG</span>
        </div>
        <div className="terminal-feed">
          <p style={{ margin: '4px 0' }}>{'>'} Handshake established... [OK]</p>
          <p style={{ margin: '4px 0' }}>{'>'} Bypassing proxy walls...</p>
          <p style={{ margin: '4px 0', opacity: 0.7 }}>{'>'} Initializing Orion telemetry...</p>
          <p style={{ margin: '4px 0', opacity: 0.5 }}>{'>'} Decrypting deep web packets...</p>
          <p style={{ margin: '4px 0', animation: 'blink 1s infinite' }}>{'>'} Awaiting operator input _</p>
        </div>
      </div>

      <CyberCard
        style={{ 
          zIndex: 10, 
          opacity: isZooming ? 0 : 1,
          transform: isZooming ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: isZooming ? 'none' : 'auto'
        }}
        innerStyle={{ alignItems: 'center', gap: '24px' }}
      >
        <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 300, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>SYSTEM ONLINE</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Secure connection established.</p>
        </div>
        <CyberButton 
          onClick={handleEnterClick} 
          icon={<ArrowRight size={16} color="#000000" />}
        >
          <span>ENTER DASHBOARD</span>
        </CyberButton>
      </CyberCard>
    </div>
  );
}

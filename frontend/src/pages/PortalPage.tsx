import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUIStore } from '../state/uiStore';
import { useCaseStore } from '../state/caseStore';
import * as THREE from 'three';
import {
  Folder,
  Database,
  Network,
  FileText,
  Settings,
  ArrowRight,
  Zap,
  Play,
  Pause,
} from 'lucide-react';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

// ── THREE.JS DOTTED SURFACE BACKGROUND ──
type DottedSurfaceProps = {
  className?: string;
  style?: React.CSSProperties;
};

function DottedSurface({ className, style }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameIdRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;
    const SEPARATION = 100;
    const AMOUNTX = 65;
    const AMOUNTY = 95;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 1000, 8000);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      10000,
    );
    camera.position.set(0, 300, 1000);
    camera.lookAt(0, -100, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(scene.fog.color, 0);

    // Apply explicit full-container styles to the canvas element
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';

    // Clear any previous canvas overlays to prevent duplicate static canvases
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    const positions: number[] = [];
    const colors: number[] = [];

    const geometry = new THREE.BufferGeometry();

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
        const y = 0;
        const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

        positions.push(x, y, z);
        // Cyan-green holographic dots
        colors.push(0.0, 1.0, 0.76);
      }
    }

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const positionAttribute = geometry.attributes.position as any;
    positionAttribute.setUsage(THREE.DynamicDrawUsage);

    const material = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false; // Always render points regardless of bounding volumes
    scene.add(points);

    const animate = () => {
      if (isCancelled) return;

      try {
        animationFrameIdRef.current = requestAnimationFrame(animate);

        const time = performance.now() * 0.001; // Current elapsed time in seconds
        const positionsArr = positionAttribute.array as Float32Array;

        let i = 0;
        for (let ix = 0; ix < AMOUNTX; ix++) {
          for (let iy = 0; iy < AMOUNTY; iy++) {
            const index = i * 3;
            // Slightly rougher waves for high-fidelity fluid motion
            positionsArr[index + 1] =
              Math.sin((ix + time * 3) * 0.16) * 55 +
              Math.sin((iy + time * 3) * 0.22) * 55;
            i++;
          }
        }

        positionAttribute.needsUpdate = true;
        renderer.render(scene, camera);
      } catch (err) {
        console.error('ThreeJS Loop Error:', err);
      }
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
      cancelAnimationFrame(animationFrameIdRef.current);

      scene.traverse((object: any) => {
        if (object instanceof THREE.Points) {
          object.geometry.dispose();
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        ...style
      }}
    />
  );
}

// ── CUSTOM HIGH-TECH UI BLOCKS ──
function Badge({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '8px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.1em',
        border: '1px solid var(--struct-line)',
        background: 'rgba(0,0,0,0.5)',
        color: 'var(--accent-primary)',
        textTransform: 'uppercase',
        ...style
      }}
    >
      {children}
    </span>
  );
}

function Button({ children, onClick, style }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: '1px solid var(--accent-primary)',
        color: 'var(--accent-primary)',
        fontFamily: 'var(--font-heading)',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        padding: '6px 12px',
        cursor: 'pointer',
        boxShadow: '0 0 6px rgba(0,255,194,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        ...style
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'rgba(8, 12, 16, 0.95)',
        border: '1px solid var(--struct-line)',
        padding: '16px',
        boxShadow: '0 0 16px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...style
      }}
    >
      {children}
    </div>
  );
}

// ── PORTAL PAGE RENDERER WITH RADIAL ORBITAL TIMELINE ──
interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: 'completed' | 'in-progress' | 'pending';
  energy: number;
}

export default function PortalPage() {
  const { activeCase, cases } = useCaseStore();
  const navigate = useNavigate();

  const activeCaseId = activeCase?.caseId || (cases.length > 0 ? cases[0].caseId : null);

  const timelineData: TimelineItem[] = [
    {
      id: 1,
      title: 'CASES DASHBOARD',
      date: 'INITIALIZED',
      content: 'Unified dossier manager for active intelligence files and ad-hoc profiles.',
      category: 'CASES',
      icon: Folder,
      relatedIds: [2, 5],
      status: 'completed',
      energy: 100,
    },
    {
      id: 2,
      title: 'SEED INTAKE',
      date: 'READY',
      content: 'Seed identifiers registry for crawler engines and WHOIS search inlets.',
      category: 'INTAKE',
      icon: Database,
      relatedIds: [1, 3],
      status: activeCaseId ? 'completed' : 'pending',
      energy: 80,
    },
    {
      id: 3,
      title: 'LINK ANALYSIS',
      date: 'ACTIVE',
      content: 'Cytoscape interactive node maps and XGBoost Jaro-Winkler similarities.',
      category: 'INVESTIGATE',
      icon: Network,
      relatedIds: [2, 4],
      status: activeCaseId ? 'in-progress' : 'pending',
      energy: 65,
    },
    {
      id: 4,
      title: 'REPORT EXPORTER',
      date: 'COMPLIANCE',
      content: 'Narrative synthesis templates with telemetry diagnostic headers.',
      category: 'EXPORT',
      icon: FileText,
      relatedIds: [3],
      status: 'pending',
      energy: 25,
    },
    {
      id: 5,
      title: 'NEURAL CONFIG',
      date: 'ONLINE',
      content: 'Model accuracy weights and booster feature parameters console.',
      category: 'SETTINGS',
      icon: Settings,
      relatedIds: [1],
      status: 'completed',
      energy: 90,
    },
  ];

  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const centerViewOnNode = (nodeId: number) => {
    if (!nodeRefs.current[nodeId]) return;
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) {
          newState[parseInt(key)] = false;
        }
      });

      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);

        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer: any;
    if (autoRotate) {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => (prev + 0.25) % 360);
      }, 50);
    }
    return () => clearInterval(rotationTimer);
  }, [autoRotate]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 220;
    const radian = (angle * Math.PI) / 180;

    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);

    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.4,
      Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))
    );

    return { x, y, angle, zIndex, opacity };
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
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
      {/* Three.js Holographic Background */}
      <DottedSurface />

      {/* Brand Header */}
      <div
        style={{
          position: 'absolute',
          top: '30px',
          zIndex: 10,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-heading)',
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--accent-primary)',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(0,255,194,0.4)',
          }}
        >
          e-RAKSHAK
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

      {/* Orbital Arena */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '800px', height: '100%', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        <div
          ref={orbitRef}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformStyle: 'preserve-3d',
            perspective: '1000px',
          }}
        >
          {/* Central Holographic Core */}
          <div
            style={{
              position: 'absolute',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-primary) 0%, rgba(0,255,194,0.1) 70%)',
              boxShadow: '0 0 30px rgba(0,255,194,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            {/* Pulsing ring */}
            <div
              className="animate-ping"
              style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '50%',
                border: '1px solid var(--accent-primary)',
                opacity: 0.3,
              }}
            />
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 0 10px #ffffff',
              }}
            />
          </div>

          {/* Orbital path guide */}
          <div
            style={{
              position: 'absolute',
              width: '440px',
              height: '440px',
              borderRadius: '50%',
              border: '1px dashed rgba(0,255,194,0.15)',
              pointerEvents: 'none',
            }}
          />

          {/* Timeline Node Ring */}
          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                ref={(el) => { nodeRefs.current[item.id] = el; }}
                style={{
                  position: 'absolute',
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: isExpanded ? 500 : position.zIndex,
                  opacity: isExpanded ? 1 : position.opacity,
                  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
              >
                {/* Energy pulse aura */}
                <div
                  className={cn(isPulsing && 'animate-pulse')}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: `${item.energy * 0.4 + 40}px`,
                    height: `${item.energy * 0.4 + 40}px`,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,255,194,0.1) 0%, rgba(0,255,194,0) 70%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Main Node Button */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: isExpanded
                      ? 'var(--accent-primary)'
                      : isRelated
                      ? 'rgba(0,255,194,0.25)'
                      : '#080c10',
                    border: `1.5px solid ${
                      isExpanded || isRelated
                        ? 'var(--accent-primary)'
                        : 'var(--struct-line)'
                    }`,
                    color: isExpanded ? '#000000' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isExpanded ? '0 0 15px rgba(0,255,194,0.6)' : 'none',
                  }}
                >
                  <Icon size={15} />
                </div>

                {/* Node Title */}
                <div
                  style={{
                    position: 'absolute',
                    top: '44px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '8px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: isExpanded ? 'var(--accent-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  {item.title}
                </div>

                {/* Expanded Card Details */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '70px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 1000,
                    }}
                  >
                    <Card style={{ width: '250px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--struct-line)', paddingBottom: '8px' }}>
                        <Badge>{item.status}</Badge>
                        <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {item.date}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '11px', color: 'var(--text-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {item.title}
                        </h4>
                        <p style={{ margin: 0, fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: '1.3' }}>
                          {item.content}
                        </p>
                      </div>

                      {/* Energy / Activity Bar */}
                      <div style={{ borderTop: '1px solid var(--struct-line)', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Zap size={9} />
                            STABILITY FACTOR
                          </span>
                          <span>{item.energy}%</span>
                        </div>
                        <div style={{ width: '100%', height: '2px', background: 'var(--struct-line)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              background: 'var(--accent-primary)',
                              width: `${item.energy}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Navigation Link Launcher */}
                      <div style={{ borderTop: '1px solid var(--struct-line)', paddingTop: '8px' }}>
                        <Button
                          onClick={() => navigate('/login')}
                          style={{
                            width: '100%',
                            background: 'var(--accent-primary)',
                            color: '#000000',
                            border: 'none',
                          }}
                        >
                          <span>LAUNCH WORKSPACE</span>
                          <ArrowRight size={10} />
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual rotation controls in bottom-right corner */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          gap: '8px',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          style={{
            background: 'none',
            border: '1px solid var(--struct-line)',
            color: 'var(--text-muted)',
            padding: '6px 8px',
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {autoRotate ? <Pause size={10} /> : <Play size={10} />}
          <span>{autoRotate ? 'PAUSE ROTATION' : 'RESUME ROTATION'}</span>
        </button>
      </div>
    </div>
  );
}

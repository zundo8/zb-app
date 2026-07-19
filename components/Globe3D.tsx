"use client";

import { useEffect, useRef, useState } from "react";

interface CountryMarker {
  name: string;
  count: number;
  lat: number;
  lon: number;
}

// Lat, Lon coordinates for matching visitor countries
const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  "IN": [20.5937, 78.9629],
  "US": [37.0902, -95.7129],
  "GB": [55.3781, -3.4360],
  "DE": [51.1657, 10.4515],
  "AE": [23.4241, 53.8478],
  "SG": [1.3521, 103.8198],
  "CA": [56.1304, -106.3468],
  "AU": [-25.2744, 133.7751],
  "SA": [23.8859, 45.0792],
  "RU": [61.5240, 105.3188],
  "FR": [46.2276, 2.2137],
  "IT": [41.8719, 12.5674],
  "JP": [36.2048, 138.2529],
  "CN": [35.8617, 104.1954],
  "BR": [-14.2350, -51.9253],
  "ZA": [-30.5595, 22.9375],
  "INDA": [20.5937, 78.9629],
  "India": [20.5937, 78.9629],
  "United States": [37.0902, -95.7129],
  "United Kingdom": [55.3781, -3.4360],
  "Germany": [51.1657, 10.4515],
  "United Arab Emirates": [23.4241, 53.8478],
  "Singapore": [1.3521, 103.8198],
  "Canada": [56.1304, -106.3468],
  "Australia": [-25.2744, 133.7751],
  "Saudi Arabia": [23.8859, 45.0792],
  "Russia": [61.5240, 105.3188],
  "France": [46.2276, 2.2137],
  "Italy": [41.8719, 12.5674],
  "Japan": [36.2048, 138.2529],
  "China": [35.8617, 104.1954],
  "Brazil": [-14.2350, -51.9253],
  "South Africa": [-30.5595, 22.9375],
};

// Simplified continent borders detection function for generating land dots
function isLand(lat: number, lon: number): boolean {
  // North America
  if (lat > 15 && lat < 78 && lon > -168 && lon < -52) {
    if (lat > 55 && lon < -130) return false; // Alaska/Canada edge
    if (lat < 25 && lon > -80) return false; // Caribbean Gulf
    return true;
  }
  // South America
  if (lat > -56 && lat < 13 && lon > -82 && lon < -34) {
    if (lat > 5 && lon < -75) return false;
    return true;
  }
  // Africa
  if (lat > -35 && lat < 37 && lon > -18 && lon < 51) {
    if (lat > 18 && lon > 34) return false; // Red Sea / Arabia split
    return true;
  }
  // Europe
  if (lat > 36 && lat < 72 && lon > -10 && lon < 45) {
    if (lat < 42 && lon > 20) return false; // Mediterranean
    return true;
  }
  // Asia
  if (lat > 5 && lat < 75 && lon >= 45 && lon < 180) {
    if (lat < 12 && lon < 100) return false; // Indian ocean south of India
    if (lat < 25 && lon > 40 && lon < 60) return true; // Arabian Peninsula
    if (lat < 22 && lon > 65 && lon < 90) return true; // India
    return true;
  }
  // Australia
  if (lat > -48 && lat < -10 && lon > 113 && lon < 154) {
    return true;
  }
  // Greenland
  if (lat > 60 && lat < 83 && lon > -73 && lon < -10) {
    return true;
  }
  return false;
}

interface Globe3DProps {
  countries: Record<string, number>;
}

export default function Globe3D({ countries }: Globe3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const hoveredCountryRef = useRef<string | null>(null);

  // Interaction State
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0.2, y: 0 }); // X: pitch, Y: yaw
  const targetRotation = useRef({ x: 0.2, y: 0 });
  const velocity = useRef({ x: 0, y: 0.003 }); // Autorotate default on Y

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    // Generate Globe Dot Matrix once
    const dots: { lat: number; lon: number }[] = [];
    const latStep = 4.5;
    const lonStep = 4.5;

    for (let lat = -80; lat <= 80; lat += latStep) {
      // Vary longitude density depending on latitude to maintain uniform dot sizing
      const circumference = Math.cos((lat * Math.PI) / 180);
      const adjustedLonStep = circumference > 0.1 ? lonStep / circumference : 360;

      for (let lon = -180; lon < 180; lon += adjustedLonStep) {
        if (isLand(lat, lon)) {
          dots.push({ lat, lon });
        }
      }
    }

    // Process Country markers
    const markers: CountryMarker[] = [];
    Object.entries(countries).forEach(([countryName, count]) => {
      const coords = COUNTRY_COORDINATES[countryName];
      if (coords && count > 0) {
        markers.push({
          name: countryName,
          count,
          lat: coords[0],
          lon: coords[1],
        });
      }
    });

    // Handle responsive sizing using ResizeObserver to prevent collapsing to 0
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const displayWidth = width > 0 ? width : 300;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = displayWidth * dpr;
        canvas.height = displayWidth * dpr; // Keep square ratio
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayWidth}px`;
        ctx.scale(dpr, dpr);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Dynamic animation loop
    let pulseTime = 0;

    const draw = () => {
      pulseTime += 0.04;
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const radius = width * 0.4;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Smooth rotation dampening
      if (isDragging.current) {
        rotation.current.x += (targetRotation.current.x - rotation.current.x) * 0.15;
        rotation.current.y += (targetRotation.current.y - rotation.current.y) * 0.15;
        // Damp down velocity during drag
        velocity.current.x *= 0.8;
        velocity.current.y *= 0.8;
      } else {
        // Apply inertia from drag, otherwise default auto-spin
        rotation.current.y += velocity.current.y;
        rotation.current.x += velocity.current.x;
        
        // Decay speed back to default auto-spin
        velocity.current.y += (0.003 - velocity.current.y) * 0.05;
        velocity.current.x += (0 - velocity.current.x) * 0.05;
      }

      // Restrict pitch angle to prevent flipping upside down (-80 to 80 deg)
      rotation.current.x = Math.max(-1.2, Math.min(1.2, rotation.current.x));

      // Draw Atmospheric Glow
      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.25);
      // Dark/Apple mode colors
      glowGrad.addColorStop(0, "rgba(99, 102, 241, 0.02)");
      glowGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.08)");
      glowGrad.addColorStop(0.8, "rgba(139, 92, 246, 0.05)");
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Draw sphere backdrop (deep black liquid morph feeling)
      const bgGrad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      bgGrad.addColorStop(0, "#10101b");
      bgGrad.addColorStop(0.7, "#050508");
      bgGrad.addColorStop(1, "#020203");
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Render grid dots
      const projectedDots: { x: number; y: number; z: number; size: number }[] = [];

      dots.forEach((dot) => {
        const radLat = (dot.lat * Math.PI) / 180;
        const radLon = (dot.lon * Math.PI) / 180;

        // Apply 3D Y-rotation (longitude/yaw)
        const x1 = radius * Math.cos(radLat) * Math.sin(radLon + rotation.current.y);
        const y1 = -radius * Math.sin(radLat);
        const z1 = radius * Math.cos(radLat) * Math.cos(radLon + rotation.current.y);

        // Apply 3D X-rotation (latitude/pitch)
        const cosX = Math.cos(rotation.current.x);
        const sinX = Math.sin(rotation.current.x);
        
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const x2 = x1;

        // Orthographic projection
        const scale = (z2 + radius) / (radius * 2); // Depth scale [0, 1]
        
        projectedDots.push({
          x: cx + x2,
          y: cy + y2,
          z: z2,
          size: 1.0 + scale * 1.5,
        });
      });

      // Sort dots by depth (Z index) so background elements render first (painter's algorithm)
      projectedDots.sort((a, b) => a.z - b.z);

      projectedDots.forEach((dot) => {
        const opacity = dot.z > 0 
          ? 0.15 + (dot.z / radius) * 0.45  // Front side: bright
          : 0.05 + ((dot.z + radius) / radius) * 0.1; // Back side: dim

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Project and render active country markers
      const projectedMarkers: { name: string; count: number; x: number; y: number; z: number }[] = [];
      let closestCountry: string | null = null;
      let minDistance = 25; // Hover range in pixels

      markers.forEach((m) => {
        const radLat = (m.lat * Math.PI) / 180;
        const radLon = (m.lon * Math.PI) / 180;

        // 3D rotations
        const x1 = radius * Math.cos(radLat) * Math.sin(radLon + rotation.current.y);
        const y1 = -radius * Math.sin(radLat);
        const z1 = radius * Math.cos(radLat) * Math.cos(radLon + rotation.current.y);

        const cosX = Math.cos(rotation.current.x);
        const sinX = Math.sin(rotation.current.x);

        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const x2 = x1;

        const mx = cx + x2;
        const my = cy + y2;

        if (z2 > 0) {
          projectedMarkers.push({
            name: m.name,
            count: m.count,
            x: mx,
            y: my,
            z: z2,
          });

          // Check if mouse is hovering near this marker
          const dx = mx - previousMousePosition.current.x;
          const dy = my - previousMousePosition.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestCountry = m.name;
          }
        }
      });

      if (closestCountry !== hoveredCountryRef.current) {
        hoveredCountryRef.current = closestCountry;
        setHoveredCountry(closestCountry);
      }

      // Render visitor markers with glow pulses and text
      projectedMarkers.forEach((m) => {
        // Pulsing scale
        const pulse = 1.0 + Math.abs(Math.sin(pulseTime + m.count)) * 0.6;
        const isHovered = hoveredCountryRef.current === m.name;

        // Outer pulse circle
        ctx.strokeStyle = isHovered 
          ? "rgba(244, 63, 94, 0.8)" 
          : "rgba(99, 102, 241, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 6 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Inner solid core
        ctx.fillStyle = isHovered ? "#f43f5e" : "#6366f1";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Marker label
        if (isHovered) {
          ctx.font = "bold 10px Inter, system-ui, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
          ctx.shadowBlur = 4;
          
          const text = `${m.name}: ${m.count} online`;
          const textWidth = ctx.measureText(text).width;
          
          // Draw tooltip background
          ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 1;
          
          ctx.beginPath();
          ctx.roundRect(m.x - textWidth / 2 - 6, m.y - 25, textWidth + 12, 18, 6);
          ctx.fill();
          ctx.stroke();

          // Draw text
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.fillText(text, m.x, m.y - 12);
          ctx.textAlign = "left"; // reset
          ctx.shadowBlur = 0; // reset
        }
      });

      // Sphere border overlay (frosted glass edge reflection)
      const gradEdge = ctx.createRadialGradient(cx, cy, radius * 0.96, cx, cy, radius);
      gradEdge.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradEdge.addColorStop(0.5, "rgba(255, 255, 255, 0.04)");
      gradEdge.addColorStop(1, "rgba(255, 255, 255, 0.18)");
      ctx.fillStyle = gradEdge;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Soft thin boundary line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // Clean up animation on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [countries]);

  // Drag interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    previousMousePosition.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (isDragging.current) {
      const deltaX = currentX - previousMousePosition.current.x;
      const deltaY = currentY - previousMousePosition.current.y;

      // Adjust rotation speed depending on size
      const rotSpeed = 0.007;
      targetRotation.current.y = rotation.current.y + deltaX * rotSpeed;
      targetRotation.current.x = rotation.current.x + deltaY * rotSpeed;

      // Record drag velocities for physics inertia
      velocity.current.y = deltaX * rotSpeed * 0.5;
      velocity.current.x = deltaY * rotSpeed * 0.5;
    }

    previousMousePosition.current = {
      x: currentX,
      y: currentY,
    };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Touch support for mobiles
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    previousMousePosition.current = {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || e.touches.length !== 1) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.touches[0].clientX - rect.left;
    const currentY = e.touches[0].clientY - rect.top;

    const deltaX = currentX - previousMousePosition.current.x;
    const deltaY = currentY - previousMousePosition.current.y;

    const rotSpeed = 0.009;
    targetRotation.current.y = rotation.current.y + deltaX * rotSpeed;
    targetRotation.current.x = rotation.current.x + deltaY * rotSpeed;

    velocity.current.y = deltaX * rotSpeed * 0.5;
    velocity.current.x = deltaY * rotSpeed * 0.5;

    previousMousePosition.current = {
      x: currentX,
      y: currentY,
    };
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-square flex items-center justify-center select-none overflow-visible">
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing max-w-full touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      />
      {hoveredCountry && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-foreground/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-semibold text-foreground/75 border border-foreground/5 pointer-events-none tracking-wide transition-all uppercase">
          Inspecting: {hoveredCountry}
        </div>
      )}
    </div>
  );
}

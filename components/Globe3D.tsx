"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { getCountryCentroid } from "@/lib/country-centroids";

// Dynamic import of Globe component from react-globe.gl (CSR only)
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export interface VisitorPoint {
  countryCode: string;
  country: string;
  city: string;
  lat: number | null;
  lng: number | null;
  count: number;
}

export interface Globe3DProps {
  points?: VisitorPoint[];
  countries?: Record<string, number>;
  unknownCount?: number;
}

interface ProcessedPoint {
  lat: number;
  lng: number;
  countryCode: string;
  country: string;
  city: string;
  count: number;
  color: string;
  size: number;
}

interface RingPoint {
  lat: number;
  lng: number;
  count: number;
}

export default function Globe3D({ points = [], countries = {}, unknownCount = 0 }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeEl = useRef<any>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 320, height: 320 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle responsive container resizing
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const w = clientWidth > 0 ? clientWidth : 320;
        const h = clientHeight > 0 ? clientHeight : w; // keep square ratio if height is 0
        setDimensions({ width: w, height: h });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Process visitor points and map missing lat/lng to country centroids
  const processedPoints = useMemo<ProcessedPoint[]>(() => {
    const list: ProcessedPoint[] = [];

    // 1. Process explicit visitor points
    if (points && points.length > 0) {
      points.forEach((p) => {
        let lat = p.lat;
        let lng = p.lng;

        if (lat == null || lng == null) {
          const centroid = getCountryCentroid(p.countryCode);
          if (centroid) {
            lat = centroid[0];
            lng = centroid[1];
          }
        }

        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
          list.push({
            lat,
            lng,
            countryCode: p.countryCode || "XX",
            country: p.country || "Unknown",
            city: p.city || "Unknown",
            count: p.count || 1,
            color: p.count > 5 ? "#f43f5e" : p.count > 1 ? "#a855f7" : "#6366f1",
            size: Math.min(0.6, 0.2 + (p.count || 1) * 0.08),
          });
        }
      });
    } else if (countries && Object.keys(countries).length > 0) {
      // 2. Fallback to country count breakdown if points list is not supplied directly
      Object.entries(countries).forEach(([countryKey, count]) => {
        if (count > 0 && countryKey !== "unknown") {
          const centroid = getCountryCentroid(countryKey);
          if (centroid) {
            list.push({
              lat: centroid[0],
              lng: centroid[1],
              countryCode: countryKey.toUpperCase(),
              country: countryKey,
              city: "Centroid",
              count,
              color: count > 5 ? "#f43f5e" : "#6366f1",
              size: Math.min(0.6, 0.2 + count * 0.08),
            });
          }
        }
      });
    }

    return list;
  }, [points, countries]);

  // Rings data for live pulse animation
  const ringPoints = useMemo<RingPoint[]>(() => {
    return processedPoints.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      count: p.count,
    }));
  }, [processedPoints]);

  // Configure Globe controls once mounted
  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.9;
        controls.enableZoom = true;
        controls.minDistance = 180;
        controls.maxDistance = 450;
      }
    }
  }, [mounted, dimensions]);

  if (!mounted) {
    return (
      <div ref={containerRef} className="relative w-full aspect-square flex items-center justify-center bg-foreground/[0.02] rounded-2xl">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground/80 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full aspect-square flex items-center justify-center select-none overflow-hidden rounded-2xl">
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0, 0, 0, 0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#6366f1"
        atmosphereAltitude={0.18}
        
        // Points layer
        pointsData={processedPoints}
        pointColor={(d: any) => d.color || "#6366f1"}
        pointAltitude={0.03}
        pointRadius={(d: any) => d.size || 0.25}
        pointResolution={32}
        pointsMerge={false}

        // Tooltip formatting
        pointLabel={(d: any) => `
          <div style="
            background: rgba(10, 10, 18, 0.92);
            backdrop-filter: blur(12px);
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 11px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            pointer-events: none;
            line-height: 1.4;
          ">
            <div style="font-weight: 700; color: #a5b4fc; margin-bottom: 2px;">
              ${d.city && d.city !== "Unknown" && d.city !== "Centroid" ? `${d.city}, ` : ""}${d.country} (${d.countryCode})
            </div>
            <div style="color: #94a3b8; font-size: 10px; display: flex; items-center; gap: 4px;">
              <span style="color: #34d399; font-weight: 600;">● ${d.count}</span> active visitor${d.count > 1 ? "s" : ""}
            </div>
          </div>
        `}

        // Pulse Rings layer
        ringsData={ringPoints}
        ringColor={() => (t: number) => `rgba(99, 102, 241, ${Math.max(0, 1 - t)})`}
        ringMaxRadius={(d: any) => Math.min(5, 2 + (d.count || 1) * 0.6)}
        ringPropagationSpeed={1.5}
        ringRepeatPeriod={1400}
      />

      {/* Empty State Overlay */}
      {processedPoints.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-background/20 backdrop-blur-[2px] rounded-2xl p-4 text-center">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping mb-2" />
          <span className="text-xs font-semibold text-foreground/60 tracking-wide">Waiting for live visitors…</span>
          <span className="text-[10px] text-foreground/30 mt-0.5">Real-time sessions will appear on the map</span>
        </div>
      )}

      {/* Unresolved Location Chip */}
      {unknownCount > 0 && (
        <div className="absolute bottom-2 left-2 bg-foreground/10 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-medium text-foreground/60 border border-foreground/10 pointer-events-none flex items-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>{unknownCount} visitor{unknownCount > 1 ? "s" : ""} location unresolved</span>
        </div>
      )}
    </div>
  );
}

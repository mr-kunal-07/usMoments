import { useState, useCallback, useRef, useEffect, memo } from "react";
import { Plus, Loader2, Map, List, LocateFixed } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTravelLocations, TravelLocation } from "@/hooks/useTravelLocations";
import { useMyCouple } from "@/hooks/useCouple";
import { useMedia } from "@/hooks/useMedia";
import { TravelMapCanvas, ReverseGeoResult } from "./TravelMapCanvas";
import { AddLocationModal } from "./AddLocationModal";
import { LocationPopup } from "./LocationPopup";
import { TimelineView } from "./TimelineView";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Must match --nav-height in globals.css and the value used in LocationPopup. */
const NAV_HEIGHT_PX = 52;

type TabId = "map" | "timeline";

interface PendingPin {
  lat: number;
  lng: number;
  geo?: ReverseGeoResult;
}

const EmptyOverlay = memo(function EmptyOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-3">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        className="text-4xl"
        aria-hidden
      >
        📍
      </motion.div>
      <motion.p
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-sm font-medium text-foreground/80 bg-background/90 backdrop-blur-md px-5 py-2.5 rounded-full border border-border/50 shadow-lg"
      >
        Tap anywhere on the map to pin a memory
      </motion.p>
    </div>
  );
});

const NoCoupleState = memo(function NoCoupleState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6 gap-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 180 }}
        className="relative"
      >
        <span className="text-6xl" aria-hidden>🗺️</span>
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/10"
          animate={{ scale: [1, 1.7, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      </motion.div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">Link with a Partner First</h3>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Travel Map is a couples feature. Connect with your partner to start pinning shared memories.
        </p>
      </div>
    </div>
  );
});

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "map", label: "Map", icon: Map },
  { id: "timeline", label: "Timeline", icon: List },
];

const TabBar = memo(function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 p-1 rounded-xl bg-background/90 backdrop-blur-md border border-border/50 shadow-md"
      role="tablist"
      aria-label="Travel view"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={cn(
            "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            active === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
});

const LocatingPill = memo(function LocatingPill() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500 text-white text-xs font-semibold shadow-lg"
    >
      <LocateFixed className="h-3 w-3 animate-pulse" aria-hidden />
      Finding your location…
    </motion.div>
  );
});

const MapSkeleton = memo(function MapSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/20 gap-3">
      <Loader2 className="h-7 w-7 text-primary animate-spin" aria-label="Loading map" />
      <p className="text-xs text-muted-foreground animate-pulse">Loading your map…</p>
    </div>
  );
});

export function TravelMapView() {
  const { data: couple } = useMyCouple();
  const isCouple = couple?.status === "active";

  const { data: locations = [], isLoading } = useTravelLocations();

  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<TravelLocation | null>(null);
  const [focusLocation, setFocusLocation] = useState<TravelLocation | null>(null);
  const [locating, setLocating] = useState(false);

  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const addModalKey = useRef(0);

  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarH, setTopBarH] = useState(112);

  useEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setTopBarH(entries[0].contentRect.height + 16);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number, geo?: ReverseGeoResult) => {
    if (!geo) {
      addModalKey.current += 1;
      setPendingPin({ lat, lng });
      setAddOpen(true);
    } else {
      setPendingPin(prev => prev ? { ...prev, geo } : { lat, lng, geo });
    }
  }, []);

  const handlePinClick = useCallback((loc: TravelLocation) => {
    setSelectedLocation(loc);
    setFocusLocation(loc);
  }, []);

  const handleAddClose = useCallback(() => {
    setAddOpen(false);
    setPendingPin(null);
  }, []);

  const handlePopupClose = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab !== "map") setFocusLocation(null);
    setActiveTab(tab);
  }, []);

  const handleOpenAdd = useCallback(() => {
    addModalKey.current += 1;
    setPendingPin(null);
    setAddOpen(true);
  }, []);

  const handleTimelineSelect = useCallback((loc: TravelLocation) => {
    handlePinClick(loc);
    setActiveTab("map");
  }, [handlePinClick]);

  if (!isCouple) return <NoCoupleState />;

  const mapHeight = `calc(100dvh - ${NAV_HEIGHT_PX}px - env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      className="relative flex flex-col bg-background overflow-hidden"
      style={{ height: mapHeight, isolation: "isolate" }}
    >
      <div
        ref={topBarRef}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 w-full px-3 sm:px-0 sm:w-auto pointer-events-none"
      >
        <div className="pointer-events-auto flex items-center gap-2">
          <TabBar active={activeTab} onChange={handleTabChange} />
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-xl gap-1.5 px-3 shadow-md"
            onClick={handleOpenAdd}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add place
          </Button>
          <AnimatePresence mode="wait">
            {locating && <LocatingPill key="locating" />}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {activeTab === "map" && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
            style={{ zIndex: 0 }}
          >
            {isLoading ? (
              <MapSkeleton />
            ) : (
              <TravelMapCanvas
                locations={locations}
                onMapClick={handleMapClick}
                onPinClick={handlePinClick}
                focusLocation={focusLocation}
                onLocating={setLocating}
              />
            )}
            {!isLoading && locations.length === 0 && <EmptyOverlay />}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {activeTab === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto pb-28 sm:pb-8"
            style={{ paddingTop: topBarH, zIndex: 1 }}
          >
            <TimelineView locations={locations} onSelectLocation={handleTimelineSelect} />
          </motion.div>
        )}
      </AnimatePresence>

      <AddLocationModal
        key={addModalKey.current}
        open={addOpen}
        onClose={handleAddClose}
        initialLat={pendingPin?.lat}
        initialLng={pendingPin?.lng}
        initialGeo={pendingPin?.geo}
      />

      <LocationPopup location={selectedLocation} onClose={handlePopupClose} />
    </div>
  );
}

export default TravelMapView;

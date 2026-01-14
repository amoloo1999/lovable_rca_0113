import { useState, useMemo, useEffect } from 'react';
import { FileDown, BarChart3, Loader2, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Store, StoreMetadata, AdjustmentFactors, RateRecord, FeatureCode, StoreRankings } from '@/types/rca';

// Default unit sizes from RCA_script.py
const DEFAULT_UNIT_SIZES = ['5x5', '5x10', '10x10', '10x15', '10x20', '10x25', '10x30'];
const ALL_UNIT_SIZES = ['5x5', '5x10', '10x5', '10x10', '10x15', '10x20', '10x25', '10x30', '10x40', '15x15', '15x20', '20x20'];

interface StepDataVisualizationProps {
  subjectStore: Store | null;
  selectedStores: Store[];
  storeMetadata: Record<number, StoreMetadata>;
  storeRankings: Record<number, StoreRankings>;
  adjustmentFactors: AdjustmentFactors;
  rateRecords: RateRecord[];
  customNames: Record<number, string>;
  featureCodes: FeatureCode[];
  onExport: () => void;
  isLoading: boolean;
  onBack: () => void;
}

interface GroupedData {
  size: string;
  featureCode: string;
  stores: {
    storeId: number;
    storeName: string;
    distance: number;
    yearBuilt: number | null;
    squareFootage: number | null;
    isSubject: boolean;
    t12Asking: number | null;
    t12AskingAdj: number | null;
    t12InStore: number | null;
    t6Asking: number | null;
    t6AskingAdj: number | null;
    t6InStore: number | null;
    t3Asking: number | null;
    t3AskingAdj: number | null;
    t3InStore: number | null;
    t1Asking: number | null;
    t1AskingAdj: number | null;
    t1InStore: number | null;
    adjustment: number;
    recordCount: number;
  }[];
  averages: {
    t12Asking: number | null;
    t12AskingAdj: number | null;
    t12InStore: number | null;
    t6Asking: number | null;
    t6AskingAdj: number | null;
    t6InStore: number | null;
    t3Asking: number | null;
    t3AskingAdj: number | null;
    t3InStore: number | null;
    t1Asking: number | null;
    t1AskingAdj: number | null;
    t1InStore: number | null;
  };
  marketShare: number;
}

export function StepDataVisualization({ 
  subjectStore, 
  selectedStores, 
  storeMetadata,
  storeRankings,
  adjustmentFactors, 
  rateRecords,
  customNames,
  featureCodes,
  onExport, 
  isLoading, 
  onBack 
}: StepDataVisualizationProps) {
  const [selectedSizes, setSelectedSizes] = useState<string[]>(DEFAULT_UNIT_SIZES);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showSizeSelector, setShowSizeSelector] = useState(false);

  // Calculate total adjustment
  const totalAdjustment = 
    (adjustmentFactors.captiveMarketPremium || 0) + 
    (adjustmentFactors.lossToLease || 0) + 
    (adjustmentFactors.ccAdj || 0);

  // Get feature code for a record
  const getFeatureCode = (record: RateRecord): string => {
    // Build tag from record features
    const parts: string[] = [];

    if (record.driveUp) {
      parts.push('Drive-Up');
    } else if (record.elevator) {
      parts.push('Elevator');
    } else if (record.outdoorAccess) {
      parts.push('Outdoor');
    } else {
      parts.push('Ground Level');
    }

    if (record.climateControlled) {
      parts.push('Climate Controlled');
    } else if (record.humidityControlled) {
      parts.push('Humidity Controlled');
    } else {
      parts.push('Non-Climate');
    }

    const tag = parts.join(' / ');

    // Find matching feature code
    const fc = featureCodes.find(f => f.originalTag === tag);
    if (fc) return fc.code;

    // Fallback: suggest code based on features
    const isClimate = record.climateControlled;
    if (record.driveUp) return isClimate ? 'DUCC' : 'DU';
    if (record.elevator) return isClimate ? 'ECC' : 'ENCC';
    return isClimate ? 'GLCC' : 'GNCC';
  };

  // Calculate store-specific adjustment based on rankings
  const getStoreAdjustment = (storeId: number): number => {
    if (!subjectStore || storeId === subjectStore.storeId) return 0;

    const subjectRankings = storeRankings[subjectStore.storeId];
    const compRankings = storeRankings[storeId];

    if (!subjectRankings || !compRankings) return totalAdjustment / 100;

    // Calculate adjustment based on ranking differences
    let adjustment = totalAdjustment / 100;

    // Each ranking point difference = ~1% adjustment
    const rankingCategories = ['Location', 'Age', 'Accessibility', 'VPD', 'Visibility & Signage', 'Brand', 'Quality', 'Size'] as const;
    let totalDiff = 0;

    rankingCategories.forEach(cat => {
      const subjectVal = subjectRankings[cat] || 5;
      const compVal = compRankings[cat] || 5;
      totalDiff += (subjectVal - compVal);
    });

    // Average difference across categories, scaled
    adjustment += (totalDiff / rankingCategories.length) * 0.01;

    return adjustment;
  };

  // Group and process rate data
  const groupedData = useMemo(() => {
    if (rateRecords.length === 0) return [];

    const now = new Date();
    const t12Start = new Date(now);
    t12Start.setMonth(t12Start.getMonth() - 12);
    const t6Start = new Date(now);
    t6Start.setMonth(t6Start.getMonth() - 6);
    const t3Start = new Date(now);
    t3Start.setMonth(t3Start.getMonth() - 3);
    const t1Start = new Date(now);
    t1Start.setMonth(t1Start.getMonth() - 1);

    // Normalize size for comparison
    const normalizeSize = (size: string) => {
      return size.toLowerCase().replace(/\s/g, '').replace(/'/g, '');
    };

    // Filter to selected sizes
    const allowedSizes = new Set(selectedSizes.map(s => normalizeSize(s)));

    // Group by (size, featureCode)
    const groups: Record<string, Record<number, RateRecord[]>> = {};

    rateRecords.forEach(record => {
      const size = record.size || '';
      const normalizedSize = normalizeSize(size);

      if (!allowedSizes.has(normalizedSize)) return;

      const featureCode = getFeatureCode(record);
      const groupKey = `${size}|${featureCode}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {};
      }

      if (!groups[groupKey][record.storeId]) {
        groups[groupKey][record.storeId] = [];
      }

      groups[groupKey][record.storeId].push(record);
    });

    // Calculate averages for each group
    const calcAverages = (records: RateRecord[], startDate: Date) => {
      const filtered = records.filter(r => {
        const date = new Date(r.date);
        return date >= startDate;
      });

      const walkIn = filtered.filter(r => r.walkInPrice).map(r => r.walkInPrice!);
      const online = filtered.filter(r => r.onlinePrice).map(r => r.onlinePrice!);

      return {
        inStore: walkIn.length > 0 ? walkIn.reduce((a, b) => a + b, 0) / walkIn.length : null,
        asking: online.length > 0 ? online.reduce((a, b) => a + b, 0) / online.length : null,
      };
    };

    // Parse size for sorting
    const parseSize = (sizeStr: string): number => {
      const parts = sizeStr.toLowerCase().replace(/x/g, ' ').replace(/'/g, '').split(/\s+/);
      try {
        if (parts.length >= 2) {
          return parseFloat(parts[0]) * parseFloat(parts[1]);
        }
        return parseFloat(parts[0]) || 0;
      } catch {
        return 0;
      }
    };

    // Build grouped data
    const result: GroupedData[] = [];
    const totalRecords = rateRecords.length;

    Object.entries(groups).forEach(([groupKey, storeRecords]) => {
      const [size, featureCode] = groupKey.split('|');

      const storeData = Object.entries(storeRecords).map(([storeIdStr, records]) => {
        const storeId = parseInt(storeIdStr);
        const store = selectedStores.find(s => s.storeId === storeId);
        const metadata = storeMetadata[storeId];
        const adjustment = getStoreAdjustment(storeId);

        const t12 = calcAverages(records, t12Start);
        const t6 = calcAverages(records, t6Start);
        const t3 = calcAverages(records, t3Start);
        const t1 = calcAverages(records, t1Start);

        return {
          storeId,
          storeName: customNames[storeId] || store?.storeName || 'Unknown',
          distance: store?.distance || 0,
          yearBuilt: metadata?.yearBuilt || null,
          squareFootage: metadata?.squareFootage || null,
          isSubject: subjectStore?.storeId === storeId,
          t12Asking: t12.asking,
          t12AskingAdj: t12.asking ? t12.asking * (1 + adjustment) : null,
          t12InStore: t12.inStore,
          t6Asking: t6.asking,
          t6AskingAdj: t6.asking ? t6.asking * (1 + adjustment) : null,
          t6InStore: t6.inStore,
          t3Asking: t3.asking,
          t3AskingAdj: t3.asking ? t3.asking * (1 + adjustment) : null,
          t3InStore: t3.inStore,
          t1Asking: t1.asking,
          t1AskingAdj: t1.asking ? t1.asking * (1 + adjustment) : null,
          t1InStore: t1.inStore,
          adjustment,
          recordCount: records.length,
        };
      });

      // Sort stores: subject first, then by distance
      storeData.sort((a, b) => {
        if (a.isSubject) return -1;
        if (b.isSubject) return 1;
        return a.distance - b.distance;
      });

      // Calculate group averages
      const allGroupRecords = Object.values(storeRecords).flat();
      const t12Avg = calcAverages(allGroupRecords, t12Start);
      const t6Avg = calcAverages(allGroupRecords, t6Start);
      const t3Avg = calcAverages(allGroupRecords, t3Start);
      const t1Avg = calcAverages(allGroupRecords, t1Start);

      // Market share (percentage of total records in this group)
      const groupRecordCount = allGroupRecords.length;
      const marketShare = (groupRecordCount / totalRecords) * 100;

      result.push({
        size,
        featureCode,
        stores: storeData,
        averages: {
          t12Asking: t12Avg.asking,
          t12AskingAdj: null, // No aggregate adjusted
          t12InStore: t12Avg.inStore,
          t6Asking: t6Avg.asking,
          t6AskingAdj: null,
          t6InStore: t6Avg.inStore,
          t3Asking: t3Avg.asking,
          t3AskingAdj: null,
          t3InStore: t3Avg.inStore,
          t1Asking: t1Avg.asking,
          t1AskingAdj: null,
          t1InStore: t1Avg.inStore,
        },
        marketShare,
      });
    });

    // Sort by size then feature code
    result.sort((a, b) => {
      const sizeCompare = parseSize(a.size) - parseSize(b.size);
      if (sizeCompare !== 0) return sizeCompare;
      return a.featureCode.localeCompare(b.featureCode);
    });

    return result;
  }, [rateRecords, selectedSizes, selectedStores, subjectStore, customNames, storeMetadata, featureCodes, storeRankings, totalAdjustment]);

  // Expand all groups by default when data loads
  useEffect(() => {
    if (groupedData.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(groupedData.map(g => `${g.size}|${g.featureCode}`)));
    }
  }, [groupedData]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => {
      if (prev.includes(size)) {
        return prev.filter(s => s !== size);
      }
      return [...prev, size];
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDistance = (value: number) => {
    return `${value.toFixed(1)} mi`;
  };

  return (
    <div className="max-w-full mx-auto animate-fade-in">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold mb-2">Rate Comparison Analysis</h2>
        <p className="text-muted-foreground">
          View rate averages by unit size and feature code
        </p>
      </div>

      {/* Summary Header */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid md:grid-cols-5 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Subject Store</div>
              <div className="font-semibold truncate">{subjectStore?.storeName || 'Not selected'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Competitors</div>
              <div className="font-semibold">{selectedStores.length - 1}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Records</div>
              <div className="font-semibold">{rateRecords.length.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unit Types</div>
              <div className="font-semibold">{groupedData.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Base Adjustment</div>
              <div className="font-semibold font-mono">{totalAdjustment.toFixed(1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit Size Selector */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Unit Sizes:</span>
          <div className="flex flex-wrap gap-1">
            {selectedSizes.map(size => (
              <Badge key={size} variant="secondary" className="text-xs">
                {size}
              </Badge>
            ))}
          </div>
        </div>
        <Dialog open={showSizeSelector} onOpenChange={setShowSizeSelector}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="w-4 h-4 mr-2" />
              Configure Sizes
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Unit Sizes</DialogTitle>
              <DialogDescription>
                Choose which unit sizes to include in the analysis
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
              {ALL_UNIT_SIZES.map(size => (
                <div key={size} className="flex items-center space-x-2">
                  <Checkbox
                    id={`size-${size}`}
                    checked={selectedSizes.includes(size)}
                    onCheckedChange={() => toggleSize(size)}
                  />
                  <label htmlFor={`size-${size}`} className="text-sm font-medium cursor-pointer">
                    {size}
                  </label>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setSelectedSizes(DEFAULT_UNIT_SIZES)}>
                Reset to Default
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedSizes(ALL_UNIT_SIZES)}>
                Select All
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Data Grid */}
      {rateRecords.length === 0 ? (
        <Card className="mb-6">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No rate data available yet.</p>
              <p className="text-sm mt-1">Data will be fetched when you export.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px] border rounded-lg bg-white">
          <div className="min-w-[1200px]">
            {/* Table Header */}
            <div className="sticky top-0 bg-slate-100 z-10 border-b text-xs font-semibold">
              <div className="grid grid-cols-[280px,55px,50px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px]">
                <div className="p-2 border-r">Property Name</div>
                <div className="p-2 border-r text-center">Miles</div>
                <div className="p-2 border-r text-center">Year</div>
                <div className="p-2 border-r text-center bg-blue-100">T-12<br/>Adj</div>
                <div className="p-2 border-r text-center bg-green-100">T-12<br/>Unadj</div>
                <div className="p-2 border-r text-center bg-amber-100">T-12<br/>In-Store</div>
                <div className="p-2 border-r text-center bg-blue-100">T-6<br/>Adj</div>
                <div className="p-2 border-r text-center bg-green-100">T-6<br/>Unadj</div>
                <div className="p-2 border-r text-center bg-amber-100">T-6<br/>In-Store</div>
                <div className="p-2 border-r text-center bg-blue-100">T-3<br/>Adj</div>
                <div className="p-2 border-r text-center bg-green-100">T-3<br/>Unadj</div>
                <div className="p-2 border-r text-center bg-amber-100">T-3<br/>In-Store</div>
                <div className="p-2 border-r text-center bg-blue-100">T-1<br/>Adj</div>
                <div className="p-2 border-r text-center bg-green-100">T-1<br/>Unadj</div>
                <div className="p-2 text-center bg-amber-100">T-1<br/>In-Store</div>
              </div>
            </div>

            {/* Data Rows */}
            {groupedData.map((group) => {
              const groupKey = `${group.size}|${group.featureCode}`;
              const isExpanded = expandedGroups.has(groupKey);
              const subjectStoreData = group.stores.find(s => s.isSubject);

              return (
                <Collapsible key={groupKey} open={isExpanded} onOpenChange={() => toggleGroup(groupKey)}>
                  {/* Group Header */}
                  <CollapsibleTrigger asChild>
                    <div className="grid grid-cols-[280px,55px,50px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px] bg-slate-200 hover:bg-slate-300 cursor-pointer border-b text-xs font-semibold">
                      <div className="p-2 border-r flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <span className="text-muted-foreground">{formatPercent(group.marketShare)}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{group.size}</Badge>
                        <Badge className="text-[10px]">{group.featureCode}</Badge>
                      </div>
                      <div className="p-2 border-r"></div>
                      <div className="p-2 border-r"></div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">
                        {subjectStoreData ? formatCurrency(subjectStoreData.t12AskingAdj) : 'N/A'}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t12Asking)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t12InStore)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">
                        {subjectStoreData ? formatCurrency(subjectStoreData.t6AskingAdj) : 'N/A'}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t6Asking)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t6InStore)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">
                        {subjectStoreData ? formatCurrency(subjectStoreData.t3AskingAdj) : 'N/A'}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t3Asking)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t3InStore)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">
                        {subjectStoreData ? formatCurrency(subjectStoreData.t1AskingAdj) : 'N/A'}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t1Asking)}
                      </div>
                      <div className="p-2 text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t1InStore)}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    {/* Store Rows */}
                    {group.stores.map((store, idx) => (
                      <div 
                        key={store.storeId}
                        className={`grid grid-cols-[280px,55px,50px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px] border-b text-xs ${
                          store.isSubject ? 'bg-green-100 font-medium' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <div className="p-2 border-r truncate flex items-center gap-1">
                          <span className="text-muted-foreground w-4 text-right">{idx + 1}</span>
                          <span className="truncate">{store.storeName}</span>
                          {store.isSubject && <Badge variant="default" className="ml-1 text-[9px] py-0 px-1">Subject</Badge>}
                        </div>
                        <div className="p-2 border-r text-center font-mono text-muted-foreground">
                          {store.distance > 0 ? formatDistance(store.distance) : '-'}
                        </div>
                        <div className="p-2 border-r text-center text-muted-foreground">
                          {store.yearBuilt || '-'}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-blue-50">
                          {formatCurrency(store.t12AskingAdj)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-green-50">
                          {formatCurrency(store.t12Asking)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-amber-50">
                          {formatCurrency(store.t12InStore)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-blue-50">
                          {formatCurrency(store.t6AskingAdj)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-green-50">
                          {formatCurrency(store.t6Asking)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-amber-50">
                          {formatCurrency(store.t6InStore)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-blue-50">
                          {formatCurrency(store.t3AskingAdj)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-green-50">
                          {formatCurrency(store.t3Asking)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-amber-50">
                          {formatCurrency(store.t3InStore)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-blue-50">
                          {formatCurrency(store.t1AskingAdj)}
                        </div>
                        <div className="p-2 border-r text-center font-mono bg-green-50">
                          {formatCurrency(store.t1Asking)}
                        </div>
                        <div className="p-2 text-center font-mono bg-amber-50">
                          {formatCurrency(store.t1InStore)}
                        </div>
                      </div>
                    ))}

                    {/* Average Row */}
                    <div className="grid grid-cols-[280px,55px,50px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px,70px] bg-slate-300 border-b-2 border-slate-400 text-xs font-bold">
                      <div className="p-2 border-r pl-6">Average</div>
                      <div className="p-2 border-r"></div>
                      <div className="p-2 border-r"></div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">N/A</div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t12Asking)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t12InStore)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">N/A</div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t6Asking)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t6InStore)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">N/A</div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t3Asking)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t3InStore)}
                      </div>
                      <div className="p-2 border-r text-center font-mono bg-blue-200">N/A</div>
                      <div className="p-2 border-r text-center font-mono bg-green-200">
                        {formatCurrency(group.averages.t1Asking)}
                      </div>
                      <div className="p-2 text-center font-mono bg-amber-200">
                        {formatCurrency(group.averages.t1InStore)}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Export Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Export to CSV
          </CardTitle>
          <CardDescription>
            Download your analysis as CSV files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">Full Data Dump</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Complete rate records with all details
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">Summary Report</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Grouped averages with T-period calculations
              </p>
            </div>
          </div>

          <Button onClick={onExport} disabled={isLoading} className="w-full" size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Reports...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Export CSV Reports
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Start New Analysis
        </Button>
      </div>
    </div>
  );
}

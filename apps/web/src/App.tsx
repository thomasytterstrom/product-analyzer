import { useEffect, useRef, useState, useMemo } from "react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { createApiClient } from "./lib/api";
import { supabase } from "./lib/supabase";
import { Login } from "./Auth";
import { Session } from "@supabase/supabase-js";

type SnapshotField = { fieldKey: string; valueText: string; valueType: string };
type ConfigurationFieldRow = {
  configurationId: string;
  fieldKey: string;
  tracked: boolean;
  friendlyName: string | null;
};

type TimeSeriesPoint = {
  deviceSnapshotId: string;
  timeStampUtc: string;
  valueText: string | null;
  valueType: string | null;
};

type TimeSeriesSeries = {
  fieldKey: string;
  points: TimeSeriesPoint[];
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
] as const;

function formatIsoDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function formatIsoDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace(".000Z", "Z");
}

function getChartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function getChartColorToken(index: number) {
  const n = (index % CHART_COLORS.length) + 1;
  return `chart-${n}` as const;
}

function ChartColorDot({ index }: { index: number }) {
  switch (index % CHART_COLORS.length) {
    case 0:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-1" />;
    case 1:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-2" />;
    case 2:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-3" />;
    case 3:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-4" />;
    default:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-5" />;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const api = useMemo(() => {
    return createApiClient({
      baseUrl: "",
      token: session?.access_token
    });
  }, [session]);

  const [productNumbers, setProductNumbers] = useState<string[]>([]);
  const [selectedProductNumber, setSelectedProductNumber] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ metadataMigrated: number; snapshotsMigrated: number } | null>(null);

  async function handleSync() {
    if (!session) return;
    setSyncing(true);
    try {
      const res = await api.syncData();
      if (res.success) {
        setSyncResult({ 
          metadataMigrated: res.metadataMigrated, 
          snapshotsMigrated: res.snapshotsMigrated 
        });
        
        // Refresh product numbers after sync
        const pns = await api.listProductNumbers();
        setProductNumbers(pns);
        
        // Clear result after 5 seconds
        setTimeout(() => setSyncResult(null), 5000);
      } else {
        alert("Sync finished with errors: " + res.errors.join(", "));
      }
    } catch (err: any) {
      console.error("Sync failed", err);
      alert("Sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  }

  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [selectedSerialNumber, setSelectedSerialNumber] = useState<string>("");
  const [snapshots, setSnapshots] = useState<
    Array<{ deviceSnapshotId: string; snapshotId: string; timeStampUtc: string }>
  >([]);
  const [selectedDeviceSnapshotId, setSelectedDeviceSnapshotId] = useState<string>("");
  const [compareDeviceSnapshotId, setCompareDeviceSnapshotId] = useState<string>("");
  const [fields, setFields] = useState<SnapshotField[]>([]);
  const [compareFields, setCompareFields] = useState<SnapshotField[]>([]);

  const [workspaceTab, setWorkspaceTab] = useState<"configure" | "analysis">("configure");
  const [analysisTab, setAnalysisTab] = useState<"diff" | "trends">("diff");

  const [diffLoading, setDiffLoading] = useState(false);
  const [diffRows, setDiffRows] = useState<
    Array<{ fieldKey: string; aValue: string | null; bValue: string | null }>
  >([]);

  const [trendSnapshotIds, setTrendSnapshotIds] = useState<string[]>([]);
  const [trendFieldKeys, setTrendFieldKeys] = useState<string[]>([]);
  const [trendSeries, setTrendSeries] = useState<TimeSeriesSeries[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const selectAllSnapshotsRef = useRef<HTMLInputElement>(null);

  const trendSeriesIndexByKey = new Map(trendSeries.map((s, idx) => [s.fieldKey, idx] as const));

  const numericTrendSeries = trendSeries
    .map((s) => {
      const points = [...(s.points ?? [])]
        .map((p) => {
          const raw = p.valueText ?? "";
          const n = Number.parseFloat(String(raw));
          return {
            deviceSnapshotId: p.deviceSnapshotId,
            timeStampUtc: p.timeStampUtc,
            valueText: p.valueText,
            valueNumber: Number.isFinite(n) ? n : null
          };
        })
        .filter((p) => p.valueNumber !== null)
        .sort((a, b) => a.timeStampUtc.localeCompare(b.timeStampUtc));

      return { fieldKey: s.fieldKey, points };
    })
    .filter((s) => s.points.length >= 2);

  const numericTrendChartRows = (() => {
    if (numericTrendSeries.length === 0) return [] as Array<Record<string, unknown>>;

    const byTs = new Map<string, Record<string, unknown>>();
    for (const series of numericTrendSeries) {
      for (const p of series.points) {
        const row = byTs.get(p.timeStampUtc) ?? { timeStampUtc: p.timeStampUtc };
        (row as Record<string, unknown>)[series.fieldKey] = p.valueNumber;
        byTs.set(p.timeStampUtc, row);
      }
    }

    return [...byTs.values()].sort((a, b) =>
      String(a.timeStampUtc).localeCompare(String(b.timeStampUtc))
    );
  })();

  const trendChartTimeRange = (() => {
    if (numericTrendChartRows.length === 0) return null;

    const first = String(numericTrendChartRows[0]?.timeStampUtc ?? "");
    const last = String(numericTrendChartRows[numericTrendChartRows.length - 1]?.timeStampUtc ?? "");
    if (!first || !last) return null;

    return { from: first, to: last };
  })();

  const configurationId =
    fields.find((f) => f.fieldKey === "root/ConfigurationId")?.valueText?.trim() ?? "";

  const trendSnapshotSelectedCount = (() => {
    if (snapshots.length === 0) return 0;
    const selected = new Set(trendSnapshotIds);
    return snapshots.reduce((acc, s) => acc + (selected.has(s.deviceSnapshotId) ? 1 : 0), 0);
  })();

  const trendAllSnapshotsSelected = snapshots.length > 0 && trendSnapshotSelectedCount === snapshots.length;
  const trendSomeSnapshotsSelected = trendSnapshotSelectedCount > 0 && !trendAllSnapshotsSelected;

  useEffect(() => {
    if (!selectAllSnapshotsRef.current) return;
    selectAllSnapshotsRef.current.indeterminate = trendSomeSnapshotsSelected;
  }, [trendSomeSnapshotsSelected]);

  const compareConfigurationId =
    compareFields.find((f) => f.fieldKey === "root/ConfigurationId")?.valueText?.trim() ?? "";

  const [configurationFields, setConfigurationFields] = useState<ConfigurationFieldRow[]>([]);
  const [configurationFieldsLoading, setConfigurationFieldsLoading] = useState(false);
  const [configurationFieldsSaving, setConfigurationFieldsSaving] = useState(false);
  const [configurationFieldsSaveError, setConfigurationFieldsSaveError] = useState<string>("");

  const [fieldFilter, setFieldFilter] = useState<string>("");

  const valueByFieldKey = new Map(fields.map((f) => [f.fieldKey, f] as const));

  const normalizedFieldFilter = fieldFilter.trim().toLowerCase();

  function isConfigurationFieldRow(row: SnapshotField | ConfigurationFieldRow): row is ConfigurationFieldRow {
    return "tracked" in row;
  }

  function fieldRowMatchesFilter(row: SnapshotField | ConfigurationFieldRow) {
    if (!normalizedFieldFilter) return true;

    const fieldKey = row.fieldKey;
    const snap = valueByFieldKey.get(fieldKey);
    const friendlyName = isConfigurationFieldRow(row) ? row.friendlyName : null;
    const valueText = isConfigurationFieldRow(row) ? (snap?.valueText ?? "") : row.valueText;
    const valueType = isConfigurationFieldRow(row) ? (snap?.valueType ?? "") : row.valueType;

    const haystack = `${fieldKey} ${friendlyName ?? ""} ${valueText ?? ""} ${valueType ?? ""}`.toLowerCase();
    return haystack.includes(normalizedFieldFilter);
  }

  useEffect(() => {
    if (!configurationId) return;
    if (fields.length === 0) return;
    if (configurationFieldsLoading) return;

    const discoveredKeys = fields
      .map((f) => f.fieldKey)
      .filter((k) => k.length > 0 && k !== "root/ConfigurationId");

    if (discoveredKeys.length === 0) return;

    setConfigurationFields((prev) => {
      const existing = new Set(prev.map((p) => p.fieldKey));
      const additions = discoveredKeys
        .filter((k) => !existing.has(k))
        .map((fieldKey) => ({
          configurationId,
          fieldKey,
          tracked: false,
          friendlyName: null
        }));

      if (additions.length === 0) return prev;
      return [...prev, ...additions].sort((a, b) => a.fieldKey.localeCompare(b.fieldKey));
    });
  }, [configurationId, fields, configurationFieldsLoading]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void api.listProductNumbers().then((pns) => {
      if (!active) return;
      setProductNumbers(pns);
    });

    return () => {
      active = false;
    };
  }, [session, api]);

  useEffect(() => {
    if (!session) return;
    if (!selectedProductNumber) {
      setSerialNumbers([]);
      setSelectedSerialNumber("");
      setSnapshots([]);
      setSelectedDeviceSnapshotId("");
      setCompareDeviceSnapshotId("");
      setFields([]);
      setCompareFields([]);
      setFieldFilter("");

      setTrendSnapshotIds([]);
      setTrendFieldKeys([]);
      setTrendSeries([]);
      setTrendLoading(false);
      return;
    }

    let active = true;
    void api.listSerialNumbers(selectedProductNumber).then((sns) => {
      if (!active) return;
      setSerialNumbers(sns);
      setSelectedSerialNumber("");
      setSnapshots([]);
      setSelectedDeviceSnapshotId("");
      setCompareDeviceSnapshotId("");
      setFields([]);
      setCompareFields([]);
      setFieldFilter("");

      setTrendSnapshotIds([]);
      setTrendFieldKeys([]);
      setTrendSeries([]);
      setTrendLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session, api, selectedProductNumber]);

  useEffect(() => {
    if (!session) return;
    if (!selectedProductNumber || !selectedSerialNumber) {
      setSnapshots([]);
      setSelectedDeviceSnapshotId("");
      setCompareDeviceSnapshotId("");
      setFields([]);
      setCompareFields([]);
      setFieldFilter("");

      setTrendSnapshotIds([]);
      setTrendFieldKeys([]);
      setTrendSeries([]);
      setTrendLoading(false);
      return;
    }

    let active = true;
    void api
      .listSnapshots({
        productNumber: selectedProductNumber,
        serialNumber: selectedSerialNumber
      })
      .then((ss) => {
        if (!active) return;
        setSnapshots(ss);
        setSelectedDeviceSnapshotId("");
        setCompareDeviceSnapshotId("");
        setFields([]);
        setCompareFields([]);
        setFieldFilter("");

        setTrendSnapshotIds([]);
        setTrendFieldKeys([]);
        setTrendSeries([]);
        setTrendLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session, api, selectedProductNumber, selectedSerialNumber]);

  useEffect(() => {
    if (!session) return;
    if (!selectedDeviceSnapshotId) {
      setFields([]);
      return;
    }

    let active = true;
    void api.getSnapshotFields(selectedDeviceSnapshotId).then((fs) => {
      if (!active) return;
      setFields(fs);
    });

    return () => {
      active = false;
    };
  }, [session, api, selectedDeviceSnapshotId]);

  useEffect(() => {
    if (!session) return;
    if (!compareDeviceSnapshotId) {
      setCompareFields([]);
      return;
    }

    let active = true;
    void api.getSnapshotFields(compareDeviceSnapshotId).then((fs) => {
      if (!active) return;
      setCompareFields(fs);
    });

    return () => {
      active = false;
    };
  }, [session, api, compareDeviceSnapshotId]);

  const trackedFieldKeys = configurationFields.filter((f) => f.tracked).map((f) => f.fieldKey);

  const trackedFriendlyNameByKey = new Map(
    configurationFields
      .filter((f) => f.tracked)
      .map((f) => [f.fieldKey, f.friendlyName] as const)
  );

  useEffect(() => {
    if (!session) return;
    if (!selectedDeviceSnapshotId || !compareDeviceSnapshotId) {
      setDiffRows([]);
      setDiffLoading(false);
      return;
    }
    if (!selectedProductNumber || !selectedSerialNumber) {
      setDiffRows([]);
      setDiffLoading(false);
      return;
    }
    if (configurationId && compareConfigurationId && configurationId !== compareConfigurationId) {
      setDiffRows([]);
      setDiffLoading(false);
      return;
    }
    if (configurationFieldsLoading) {
      setDiffRows([]);
      return;
    }
    if (trackedFieldKeys.length === 0) {
      setDiffRows([]);
      setDiffLoading(false);
      return;
    }

    let active = true;
    setDiffLoading(true);
    void api
      .getDiff({
        productNumber: selectedProductNumber,
        serialNumber: selectedSerialNumber,
        snapshotA: selectedDeviceSnapshotId,
        snapshotB: compareDeviceSnapshotId
      })
      .then((res) => {
        if (!active) return;

        const rows: Array<{ fieldKey: string; aValue: string | null; bValue: string | null }> = [];
        for (const c of res.diff.changed) rows.push({ fieldKey: c.key, aValue: c.from, bValue: c.to });
        for (const a of res.diff.added) rows.push({ fieldKey: a.key, aValue: null, bValue: a.to });
        for (const r of res.diff.removed) rows.push({ fieldKey: r.key, aValue: r.from, bValue: null });

        rows.sort((x, y) => x.fieldKey.localeCompare(y.fieldKey));
        setDiffRows(rows);
      })
      .catch(() => {
        if (!active) return;
        setDiffRows([]);
      })
      .finally(() => {
        if (!active) return;
        setDiffLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    session,
    api,
    selectedDeviceSnapshotId,
    compareDeviceSnapshotId,
    selectedProductNumber,
    selectedSerialNumber,
    configurationId,
    compareConfigurationId,
    configurationFieldsLoading,
    trackedFieldKeys.join("|")
  ]);

  async function showTrend() {
    if (!session) return;
    const fieldKeys = trendFieldKeys;
    if (fieldKeys.length === 0) return;
    if (trendSnapshotIds.length === 0) return;
    if (!selectedProductNumber || !selectedSerialNumber) return;

    setTrendLoading(true);
    try {
      const series = await api.getTimeSeries({
        productNumber: selectedProductNumber,
        serialNumber: selectedSerialNumber,
        snapshotIds: trendSnapshotIds,
        fieldKeys
      });

      const normalized = series.map((s) => ({
        fieldKey: s.fieldKey,
        points: [...s.points]
          .map((p) => ({
            deviceSnapshotId: p.deviceSnapshotId,
            timeStampUtc: p.timeStampUtc,
            valueText: p.valueText,
            valueType: p.valueType
          }))
          .sort((a, b) => a.timeStampUtc.localeCompare(b.timeStampUtc))
      }));

      setTrendSeries(normalized);
    } finally {
      setTrendLoading(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    if (!configurationId) {
      setConfigurationFields([]);
      setConfigurationFieldsLoading(false);
      return;
    }

    let active = true;
    setConfigurationFieldsLoading(true);
    void api
      .getConfigurationFields(configurationId)
      .then((rows) => {
        if (!active) return;

        const discoveredKeys = fields
          .map((f) => f.fieldKey)
          .filter((k) => k.length > 0 && k !== "root/ConfigurationId");

        setConfigurationFields((prev) => {
          const safePrev = prev.every((p) => p.configurationId === configurationId) ? prev : [];
          const byKey = new Map(safePrev.map((p) => [p.fieldKey, p] as const));

          // Server is the source of truth for tracked/friendlyName for keys it knows about.
          for (const r of rows) byKey.set(r.fieldKey, r);

          // Seed any discovered keys that aren't present yet.
          for (const fieldKey of discoveredKeys) {
            if (byKey.has(fieldKey)) continue;
            byKey.set(fieldKey, {
              configurationId,
              fieldKey,
              tracked: false,
              friendlyName: null
            });
          }

          return [...byKey.values()].sort((a, b) => a.fieldKey.localeCompare(b.fieldKey));
        });
      })
      .finally(() => {
        if (!active) return;
        setConfigurationFieldsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session, api, configurationId, fields]);

  async function saveTrackedFields() {
    if (!session || !configurationId) return;
    setConfigurationFieldsSaving(true);
    setConfigurationFieldsSaveError("");
    try {
      const updated = await api.saveConfigurationFields(
        configurationId,
        configurationFields.map((f) => ({
          fieldKey: f.fieldKey,
          tracked: f.tracked,
          friendlyName:
            f.friendlyName === undefined || f.friendlyName === null
              ? null
              : f.friendlyName.trim().length === 0
                ? null
                : f.friendlyName.trim()
        }))
      );
      setConfigurationFields(updated);
    } catch (err) {
      console.error("Failed to save tracked fields", err);
      setConfigurationFieldsSaveError("Failed to save tracked fields. Please try again.");
    } finally {
      setConfigurationFieldsSaving(false);
    }
  }

  function switchToAnalysisDiff() {
    setWorkspaceTab("analysis");
    setAnalysisTab("diff");
  }

  function compareSnapshot(deviceSnapshotId: string) {
    setCompareDeviceSnapshotId(deviceSnapshotId);
    switchToAnalysisDiff();
  }

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold leading-none tracking-tight">Product Analyzer</h1>
            <p className="text-sm text-muted-foreground">
              Browse device snapshots, choose tracked fields, compare changes, and view trends.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
               {syncResult && (
                 <span className="text-[10px] text-green-600 font-medium animate-pulse">
                   Synced {syncResult.snapshotsMigrated} snapshots
                 </span>
               )}
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={() => void handleSync()} 
                 disabled={syncing}
                 className={syncing ? "animate-pulse" : ""}
               >
                 {syncing ? "Syncing..." : "Sync Data"}
               </Button>
               <span className="text-xs text-muted-foreground">{session.user.email}</span>
               <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>Sign Out</Button>
            </div>
            {configurationId ? (
              <Badge className="max-w-[22rem] truncate" title={configurationId}>
                ConfigurationId: {configurationId}
              </Badge>
            ) : (
              <Badge variant="outline">No snapshot selected</Badge>
            )}

            {selectedDeviceSnapshotId ? (
              <Badge variant="outline" className="max-w-[22rem] truncate" title={selectedDeviceSnapshotId}>
                A: {selectedDeviceSnapshotId}
              </Badge>
            ) : null}

            {compareDeviceSnapshotId ? (
              <Badge variant="outline" className="max-w-[22rem] truncate" title={compareDeviceSnapshotId}>
                B: {compareDeviceSnapshotId}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Selection</CardTitle>
              <CardDescription>Pick a product number and serial number.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Product number</span>
                  <select
                    aria-label="Product number"
                    value={selectedProductNumber}
                    onChange={(e) => setSelectedProductNumber(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select…</option>
                    {productNumbers.map((pn) => (
                      <option key={pn} value={pn}>
                        {pn}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Serial number</span>
                  <select
                    aria-label="Serial number"
                    value={selectedSerialNumber}
                    onChange={(e) => setSelectedSerialNumber(e.target.value)}
                    disabled={!selectedProductNumber}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select…</option>
                    {serialNumbers.map((sn) => (
                      <option key={sn} value={sn}>
                        {sn}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!selectedProductNumber ? (
                <p className="text-sm text-muted-foreground">Choose a product number to load serial numbers.</p>
              ) : !selectedSerialNumber ? (
                <p className="text-sm text-muted-foreground">Choose a serial number to load snapshots.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Snapshots</CardTitle>
              <CardDescription>
                Click a snapshot to view it as A, then click <em>Compare</em> on another snapshot to set B.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm">
                <div>
                  <span className="font-medium">A (view)</span>: {selectedDeviceSnapshotId || "(select a snapshot)"}
                </div>
                <div>
                  <span className="font-medium">B (compare)</span>: {compareDeviceSnapshotId || "(click Compare on another snapshot)"}
                </div>
              </div>

              {snapshots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedProductNumber && selectedSerialNumber
                    ? "No snapshots found for this selection."
                    : "Select a product number and serial number to view snapshots."}
                </p>
              ) : (
                <div className="space-y-2">
                  {snapshots.map((s) => (
                    <div
                      key={s.deviceSnapshotId}
                      className="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDeviceSnapshotId(s.deviceSnapshotId)}
                          className="h-auto justify-start px-2 py-1 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{s.snapshotId}</span>
                            <span className="block truncate text-xs text-muted-foreground">{s.timeStampUtc}</span>
                          </span>
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-label={`Compare ${s.snapshotId}`}
                          onClick={() => compareSnapshot(s.deviceSnapshotId)}
                          disabled={!selectedDeviceSnapshotId}
                        >
                          Compare
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div
            role="tablist"
            aria-label="Workspace"
            className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
          >
            <button
              id="workspace-configure-tab"
              role="tab"
              type="button"
              aria-selected={workspaceTab === "configure"}
              aria-controls="workspace-configure-panel"
              onClick={() => setWorkspaceTab("configure")}
              className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                workspaceTab === "configure"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              Configure fields
            </button>

            <button
              id="workspace-analysis-tab"
              role="tab"
              type="button"
              aria-selected={workspaceTab === "analysis"}
              aria-controls="workspace-analysis-panel"
              onClick={() => setWorkspaceTab("analysis")}
              className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                workspaceTab === "analysis"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              Analysis
            </button>
          </div>

          {workspaceTab === "configure" ? (
            <div
              id="workspace-configure-panel"
              role="tabpanel"
              aria-labelledby="workspace-configure-tab"
              className="space-y-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Fields (Snapshot A)</CardTitle>
                  <CardDescription>
                    View Snapshot A values and configure tracked fields + friendly names (per ConfigurationId).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedDeviceSnapshotId ? (
                    <p className="text-sm text-muted-foreground">Select a snapshot to view and configure fields.</p>
                  ) : fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No fields loaded yet.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">ConfigurationId:</span>
                        {configurationId ? (
                          <Badge variant="outline" className="max-w-[30rem] truncate" title={configurationId}>
                            {configurationId}
                          </Badge>
                        ) : (
                          <Badge variant="outline">(missing)</Badge>
                        )}
                        {!configurationId ? (
                          <span className="text-xs text-muted-foreground">
                            Cannot save tracked/friendly names without{" "}
                            <span className="font-mono">root/ConfigurationId</span>.
                          </span>
                        ) : null}
                      </div>

                      {configurationId && configurationFieldsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading tracked fields…</p>
                      ) : null}

                      <label className="grid max-w-md gap-2 text-sm">
                        <span className="font-medium">Filter fields</span>
                        <Input
                          aria-label="Filter fields"
                          value={fieldFilter}
                          placeholder="Search by field key, friendly name, or value…"
                          onChange={(e) => setFieldFilter(e.target.value)}
                        />
                      </label>

                      <Table aria-label="Fields (Snapshot A)" className="table-fixed min-w-[72rem]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[32rem]">Field key</TableHead>
                            <TableHead className="w-[22rem]">Value (A)</TableHead>
                            <TableHead className="w-[8rem]">Tracked</TableHead>
                            <TableHead>Friendly name</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(configurationId
                            ? (configurationFields as Array<SnapshotField | ConfigurationFieldRow>)
                            : fields
                          )
                            .filter((row) => row.fieldKey !== "root/ConfigurationId")
                            .filter((row) => fieldRowMatchesFilter(row))
                            .map((row) => {
                              const fieldKey = row.fieldKey;
                              const snap = valueByFieldKey.get(fieldKey);
                              const editable = Boolean(configurationId) && !configurationFieldsLoading;

                              const tracked = isConfigurationFieldRow(row) ? row.tracked : false;
                              const friendlyName = isConfigurationFieldRow(row) ? row.friendlyName : null;

                              return (
                                <TableRow key={fieldKey}>
                                  <TableCell className="break-all font-mono text-xs">{fieldKey}</TableCell>
                                  <TableCell className="break-all">{snap?.valueText ?? ""}</TableCell>
                                  <TableCell>
                                    <label className="flex items-center gap-2">
                                      <Checkbox
                                        aria-label={`Track ${fieldKey}`}
                                        checked={Boolean(tracked)}
                                        disabled={!editable}
                                        onChange={(e) => {
                                          const checked = (e.target as HTMLInputElement).checked;
                                          if (!configurationId) return;

                                          // Update local state immediately.
                                          setConfigurationFields((prev) =>
                                            prev.map((p) =>
                                              p.fieldKey === fieldKey ? { ...p, tracked: checked } : p
                                            )
                                          );

                                          // Persist immediately (single-row update).
                                          void api
                                            .saveConfigurationFields(configurationId, [
                                              {
                                                fieldKey,
                                                tracked: checked,
                                                friendlyName: friendlyName ?? null
                                              }
                                            ])
                                            .then((rows) => {
                                              setConfigurationFields((prev) => {
                                                const byKey = new Map(prev.map((p) => [p.fieldKey, p] as const));
                                                for (const r of rows) byKey.set(r.fieldKey, r);
                                                return [...byKey.values()].sort((a, b) => a.fieldKey.localeCompare(b.fieldKey));
                                              });
                                            })
                                            .catch((err) => {
                                              console.error("Failed to persist tracked toggle", err);
                                            });
                                        }}
                                      />
                                      <span className="text-xs text-muted-foreground">Track</span>
                                    </label>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      aria-label={`Friendly name ${fieldKey}`}
                                      value={friendlyName ?? ""}
                                      placeholder="Optional"
                                      disabled={!editable}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (!configurationId) return;
                                        setConfigurationFields((prev) =>
                                          prev.map((p) =>
                                            p.fieldKey === fieldKey ? { ...p, friendlyName: value } : p
                                          )
                                        );
                                      }}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => void saveTrackedFields()}
                          disabled={!configurationId || configurationFieldsSaving || configurationFieldsLoading}
                        >
                          {configurationFieldsSaving ? "Saving…" : "Save tracked fields"}
                        </Button>
                      </div>

                      {configurationFieldsSaveError ? (
                        <p className="text-sm text-destructive" role="alert">
                          {configurationFieldsSaveError}
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div
              id="workspace-analysis-panel"
              role="tabpanel"
              aria-labelledby="workspace-analysis-tab"
              className="space-y-4"
            >
              <div
                role="tablist"
                aria-label="Analysis"
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
              >
                <button
                  id="analysis-diff-tab"
                  role="tab"
                  type="button"
                  aria-selected={analysisTab === "diff"}
                  aria-controls="analysis-diff-panel"
                  onClick={() => setAnalysisTab("diff")}
                  className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    analysisTab === "diff"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  Diff
                </button>

                <button
                  id="analysis-trends-tab"
                  role="tab"
                  type="button"
                  aria-selected={analysisTab === "trends"}
                  aria-controls="analysis-trends-panel"
                  onClick={() => setAnalysisTab("trends")}
                  className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    analysisTab === "trends"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  Trends
                </button>
              </div>

              {analysisTab === "diff" ? (
                <div id="analysis-diff-panel" role="tabpanel" aria-labelledby="analysis-diff-tab">
                  <Card>
                    <CardHeader>
                      <CardTitle>Diff</CardTitle>
                      <CardDescription>Compare tracked field values between snapshot A and B.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedDeviceSnapshotId || !compareDeviceSnapshotId ? (
                        <p className="text-sm text-muted-foreground">Select snapshot A and B to view a diff.</p>
                      ) : configurationId && compareConfigurationId && configurationId !== compareConfigurationId ? (
                        <p className="text-sm text-muted-foreground">
                          Cannot diff snapshots with different ConfigurationId ({configurationId} vs {compareConfigurationId}).
                        </p>
                      ) : trackedFieldKeys.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No tracked fields configured for this ConfigurationId. Mark fields as tracked above, then compare again.
                        </p>
                      ) : diffLoading ? (
                        <p className="text-sm text-muted-foreground">Loading diff…</p>
                      ) : diffRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No changes across tracked fields.</p>
                      ) : (
                        <Table aria-label="Diff">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Field</TableHead>
                              <TableHead className="w-[30%]">A</TableHead>
                              <TableHead className="w-[30%]">B</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {diffRows.map((r) => (
                              <TableRow key={r.fieldKey}>
                                <TableCell className="font-medium">
                                  {trackedFriendlyNameByKey.get(r.fieldKey) ?? r.fieldKey}
                                </TableCell>
                                <TableCell className="break-all font-mono text-xs">{r.aValue ?? ""}</TableCell>
                                <TableCell className="break-all font-mono text-xs">{r.bValue ?? ""}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div id="analysis-trends-panel" role="tabpanel" aria-labelledby="analysis-trends-tab">
                  <Card>
                    <CardHeader>
                      <CardTitle>Trends</CardTitle>
                      <CardDescription>Build a time series for a tracked field across selected snapshots.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedDeviceSnapshotId || !configurationId ? (
                        <p className="text-sm text-muted-foreground">
                          Select a snapshot with a ConfigurationId to enable trends.
                        </p>
                      ) : (
                        <div className="grid gap-4">
                          <div
                            data-testid="trend-hero"
                            className="rounded-lg border bg-muted/20 p-4 md:p-6"
                          >
                            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                              <div className="space-y-1">
                                <div className="text-sm font-medium">Chart</div>
                                <div className="text-xs text-muted-foreground">
                                  Numeric tracked fields plotted over time.
                                </div>
                              </div>

                              {trendChartTimeRange ? (
                                <div aria-label="Trend time range" className="text-xs text-muted-foreground">
                                  {formatIsoDate(trendChartTimeRange.from)} – {formatIsoDate(trendChartTimeRange.to)}
                                </div>
                              ) : null}
                            </div>

                            {numericTrendSeries.length > 0 && numericTrendChartRows.length >= 2 ? (
                              <div aria-label="Trend chart" className="h-72 w-full md:h-96">
                                <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
                                  <LineChart
                                    data={numericTrendChartRows}
                                    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                                    <XAxis dataKey="timeStampUtc" hide />
                                    <YAxis />
                                    <Tooltip labelFormatter={(label) => formatIsoDateTime(String(label))} />
                                    <Legend />
                                    {numericTrendSeries.map((s) => (
                                      <Line
                                        key={s.fieldKey}
                                        type="monotone"
                                        dataKey={s.fieldKey}
                                        name={trackedFriendlyNameByKey.get(s.fieldKey) ?? s.fieldKey}
                                        dot={false}
                                        stroke={getChartColor(trendSeriesIndexByKey.get(s.fieldKey) ?? 0)}
                                        strokeWidth={2}
                                      />
                                    ))}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="flex h-40 items-center justify-center rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
                                Select snapshots + fields, then click “Show trend” to render a chart.
                              </div>
                            )}
                          </div>

                          <div
                            data-testid="trend-controls-grid"
                            className="grid gap-4 md:grid-cols-2"
                          >
                            <div className="grid gap-2">
                              <div className="text-sm font-medium">Include snapshots</div>

                              {snapshots.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No snapshots available.</p>
                              ) : (
                                <div className="grid gap-2">
                                  <label className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                                    <Checkbox
                                      ref={selectAllSnapshotsRef}
                                      aria-label="Select all snapshots"
                                      checked={trendAllSnapshotsSelected}
                                      onChange={() => {
                                        setTrendSnapshotIds(
                                          trendAllSnapshotsSelected
                                            ? []
                                            : snapshots.map((s) => s.deviceSnapshotId)
                                        );
                                      }}
                                    />
                                    <span className="min-w-0 truncate font-medium">Select all</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      {trendSnapshotSelectedCount}/{snapshots.length}
                                    </span>
                                  </label>

                                  {snapshots.map((s) => {
                                    const checked = trendSnapshotIds.includes(s.deviceSnapshotId);
                                    return (
                                      <label
                                        key={s.deviceSnapshotId}
                                        className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                                      >
                                        <Checkbox
                                          aria-label={`Include ${s.snapshotId}`}
                                          checked={checked}
                                          onChange={(e) => {
                                            const next = (e.target as HTMLInputElement).checked;
                                            setTrendSnapshotIds((prev) =>
                                              next
                                                ? [...prev, s.deviceSnapshotId]
                                                : prev.filter((id) => id !== s.deviceSnapshotId)
                                            );
                                          }}
                                        />
                                        <span className="min-w-0 truncate">
                                          {s.snapshotId}{" "}
                                          <span className="text-xs text-muted-foreground">({s.timeStampUtc})</span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="grid gap-2">
                              <div className="text-sm font-medium">Trend fields</div>

                              {trackedFieldKeys.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  To pick trend fields, first mark one or more fields as <em>Tracked</em> in the Fields section.
                                </p>
                              ) : (
                                <div className="grid gap-2">
                                  {trackedFieldKeys.map((k) => {
                                    const checked = trendFieldKeys.includes(k);
                                    const label = trackedFriendlyNameByKey.get(k) ?? k;

                                    return (
                                      <label
                                        key={k}
                                        className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                                      >
                                        <Checkbox
                                          aria-label={`Select trend ${k}`}
                                          checked={checked}
                                          onChange={(e) => {
                                            const next = (e.target as HTMLInputElement).checked;
                                            setTrendFieldKeys((prev) =>
                                              next ? [...prev, k] : prev.filter((x) => x !== k)
                                            );
                                          }}
                                        />
                                        <span className="min-w-0 truncate">{label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <Button
                              type="button"
                              onClick={() => void showTrend()}
                              disabled={trendLoading || trendSnapshotIds.length === 0 || trendFieldKeys.length === 0}
                            >
                              {trendLoading ? "Loading…" : "Show trend"}
                            </Button>
                          </div>

                          {trendSeries.length > 0 ? (
                            <div className="space-y-3">
                              <ul aria-label="Trend series" role="list" className="flex flex-wrap gap-2 text-sm">
                                {trendSeries.map((s, idx) => {
                                  const label = trackedFriendlyNameByKey.get(s.fieldKey) ?? s.fieldKey;
                                  return (
                                    <li
                                      key={s.fieldKey}
                                      data-series-color={getChartColorToken(idx)}
                                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1"
                                    >
                                      <ChartColorDot index={idx} />
                                      <span>{label}</span>
                                    </li>
                                  );
                                })}
                              </ul>

                              <div className="space-y-4">
                                <div
                                  data-testid="trend-values-grid"
                                  className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                                >
                                {trendSeries.map((s) => {
                                  const friendlyNameRaw = trackedFriendlyNameByKey.get(s.fieldKey);
                                  const friendlyNameTrimmed = friendlyNameRaw?.trim();
                                  const friendlyName = friendlyNameTrimmed ? friendlyNameTrimmed : s.fieldKey;

                                  return (
                                    <section
                                      key={s.fieldKey}
                                      aria-label={`Trend values ${friendlyName}`}
                                        className="h-full space-y-2 rounded-md border bg-background p-3"
                                    >
                                      <div className="text-base font-semibold">
                                        {friendlyName}
                                      </div>

                                      <Table aria-label={`Trend ${friendlyName}`}>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-[16rem]">TimeStampUtc</TableHead>
                                            <TableHead>Value</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {s.points.map((p) => (
                                            <TableRow key={`${s.fieldKey}:${p.timeStampUtc}`}>
                                              <TableCell className="font-mono text-xs">{p.timeStampUtc}</TableCell>
                                              <TableCell className="break-all font-mono text-xs">{p.valueText ?? ""}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </section>
                                  );
                                })}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

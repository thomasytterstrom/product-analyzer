import { useEffect, useRef, useState } from "react";

import { createApiClient } from "./lib/api";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";

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

export default function App() {
  const [productNumbers, setProductNumbers] = useState<string[]>([]);
  const [selectedProductNumber, setSelectedProductNumber] = useState<string>("");
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
  const [trendRows, setTrendRows] = useState<Array<{ timeStampUtc: string; valueText: string | null }>>(
    []
  );
  const [trendSeries, setTrendSeries] = useState<TimeSeriesSeries[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const trendFieldKeysRef = useRef<string[]>([]);

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

  const configurationId =
    fields.find((f) => f.fieldKey === "root/ConfigurationId")?.valueText?.trim() ?? "";

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

  // Field discovery: seed the tracked-fields editor with keys present in the selected snapshot.
  // This enables first-time configurations (no rows in metadata DB yet) to start tracking.
  // Important: run after config-fields loading completes so an empty GET can't overwrite seeded rows.
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
    const api = createApiClient({ baseUrl: "" });
    let active = true;
    void api.listProductNumbers().then((pns) => {
      if (!active) return;
      setProductNumbers(pns);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
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
      trendFieldKeysRef.current = [];
      setTrendRows([]);
      setTrendSeries([]);
      setTrendLoading(false);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
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
      trendFieldKeysRef.current = [];
      setTrendRows([]);
      setTrendSeries([]);
      setTrendLoading(false);
    });

    return () => {
      active = false;
    };
  }, [selectedProductNumber]);

  useEffect(() => {
    if (!selectedProductNumber || !selectedSerialNumber) {
      setSnapshots([]);
      setSelectedDeviceSnapshotId("");
      setCompareDeviceSnapshotId("");
      setFields([]);
      setCompareFields([]);
      setFieldFilter("");

      setTrendSnapshotIds([]);
      setTrendFieldKeys([]);
      trendFieldKeysRef.current = [];
      setTrendRows([]);
      setTrendSeries([]);
      setTrendLoading(false);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
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
        trendFieldKeysRef.current = [];
        setTrendRows([]);
        setTrendSeries([]);
        setTrendLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedProductNumber, selectedSerialNumber]);

  useEffect(() => {
    if (!selectedDeviceSnapshotId) {
      setFields([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    let active = true;
    void api.getSnapshotFields(selectedDeviceSnapshotId).then((fs) => {
      if (!active) return;
      setFields(fs);
    });

    return () => {
      active = false;
    };
  }, [selectedDeviceSnapshotId]);

  useEffect(() => {
    if (!compareDeviceSnapshotId) {
      setCompareFields([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    let active = true;
    void api.getSnapshotFields(compareDeviceSnapshotId).then((fs) => {
      if (!active) return;
      setCompareFields(fs);
    });

    return () => {
      active = false;
    };
  }, [compareDeviceSnapshotId]);

  const trackedFieldKeys = configurationFields.filter((f) => f.tracked).map((f) => f.fieldKey);

  const trackedFriendlyNameByKey = new Map(
    configurationFields
      .filter((f) => f.tracked)
      .map((f) => [f.fieldKey, f.friendlyName] as const)
  );

  useEffect(() => {
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

    const api = createApiClient({ baseUrl: "" });
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
    const fieldKeys = trendFieldKeysRef.current.length > 0 ? trendFieldKeysRef.current : trendFieldKeys;
    if (fieldKeys.length === 0) return;
    if (trendSnapshotIds.length === 0) return;
    if (!selectedProductNumber || !selectedSerialNumber) return;

    const api = createApiClient({ baseUrl: "" });
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

      const first = normalized[0];
      setTrendRows(
        (first?.points ?? []).map((p) => ({ timeStampUtc: p.timeStampUtc, valueText: p.valueText }))
      );
    } finally {
      setTrendLoading(false);
    }
  }

  useEffect(() => {
    if (!configurationId) {
      setConfigurationFields([]);
      setConfigurationFieldsLoading(false);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
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
  }, [configurationId]);

  async function saveTrackedFields() {
    if (!configurationId) return;
    const api = createApiClient({ baseUrl: "" });
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

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold leading-none tracking-tight">Product Analyzer</h1>
            <p className="text-sm text-muted-foreground">
              Browse device snapshots, choose tracked fields, compare changes, and view trends.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
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

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
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

                      <Table aria-label="Fields (Snapshot A)">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[34%]">Field key</TableHead>
                            <TableHead className="w-[45%]">Value (A)</TableHead>
                            <TableHead className="w-[9rem]">Tracked</TableHead>
                            <TableHead className="w-[18rem]">Friendly name</TableHead>
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
                                  <TableCell className="font-mono text-xs">{fieldKey}</TableCell>
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
                                          const api = createApiClient({ baseUrl: "" });
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
                          <div className="grid gap-2">
                            <div className="text-sm font-medium">Include snapshots</div>

                            {snapshots.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No snapshots available.</p>
                            ) : (
                              <div className="grid gap-2">
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
                                        aria-label={`Trend ${k}`}
                                        checked={checked}
                                        onChange={(e) => {
                                          const next = (e.target as HTMLInputElement).checked;
                                          setTrendFieldKeys((prev) => {
                                            const updated = next ? [...prev, k] : prev.filter((x) => x !== k);
                                            trendFieldKeysRef.current = updated;
                                            return updated;
                                          });
                                        }}
                                      />
                                      <span className="min-w-0 truncate">{label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
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
                              {numericTrendSeries.length >= 1
                                ? (() => {
                                    const width = 640;
                                    const height = 200;
                                    const padX = 24;
                                    const padY = 24;

                                    const values = numericTrendSeries.flatMap((s) =>
                                      s.points.map((p) => p.valueNumber as number)
                                    );
                                    let minY = Math.min(...values);
                                    let maxY = Math.max(...values);
                                    if (minY === maxY) {
                                      minY -= 1;
                                      maxY += 1;
                                    }

                                    const plotW = width - padX * 2;
                                    const plotH = height - padY * 2;
                                    const xCount = Math.max(...numericTrendSeries.map((s) => s.points.length));
                                    const stepX = xCount <= 1 ? 0 : plotW / (xCount - 1);

                                    const palette = [
                                      "currentColor",
                                      "#0ea5e9",
                                      "#a855f7",
                                      "#f97316",
                                      "#22c55e"
                                    ];

                                    return (
                                      <div className="rounded-md border bg-background p-3">
                                        <svg
                                          aria-label="Trend chart"
                                          role="img"
                                          viewBox={`0 0 ${width} ${height}`}
                                          className="h-48 w-full"
                                        >
                                          <title>Trend chart</title>
                                          <rect x="0" y="0" width={width} height={height} fill="transparent" />

                                          {/* grid */}
                                          <line
                                            x1={padX}
                                            y1={padY}
                                            x2={padX}
                                            y2={height - padY}
                                            stroke="currentColor"
                                            opacity="0.15"
                                          />
                                          <line
                                            x1={padX}
                                            y1={height - padY}
                                            x2={width - padX}
                                            y2={height - padY}
                                            stroke="currentColor"
                                            opacity="0.15"
                                          />

                                          {/* lines */}
                                          {numericTrendSeries.map((series, sIdx) => {
                                            const stroke = palette[sIdx % palette.length];
                                            const pts = series.points.map((p, idx) => {
                                              const x = padX + idx * stepX;
                                              const t = ((p.valueNumber as number) - minY) / (maxY - minY);
                                              const y = padY + (1 - t) * plotH;
                                              return { x, y };
                                            });

                                            const d = pts
                                              .map(
                                                (pt, i) =>
                                                  `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`
                                              )
                                              .join(" ");

                                            return (
                                              <g key={series.fieldKey}>
                                                <path
                                                  d={d}
                                                  fill="none"
                                                  stroke={stroke}
                                                  strokeWidth="2"
                                                  opacity="0.9"
                                                />
                                                {pts.map((pt, idx) => (
                                                  <circle
                                                    key={idx}
                                                    cx={pt.x}
                                                    cy={pt.y}
                                                    r="4"
                                                    fill={stroke}
                                                    opacity="0.95"
                                                  />
                                                ))}
                                              </g>
                                            );
                                          })}
                                        </svg>
                                      </div>
                                    );
                                  })()
                                : null}

                              <ul aria-label="Trend series" role="list" className="flex flex-wrap gap-2 text-sm">
                                {trendSeries.map((s) => {
                                  const label = trackedFriendlyNameByKey.get(s.fieldKey) ?? s.fieldKey;
                                  return (
                                    <li key={s.fieldKey} className="rounded-md border bg-muted/30 px-2 py-1">
                                      {label}
                                    </li>
                                  );
                                })}
                              </ul>

                              {trendRows.length > 0 ? (
                                <Table aria-label="Trend">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[16rem]">TimeStampUtc</TableHead>
                                      <TableHead>Value</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {trendRows.map((r) => (
                                      <TableRow key={r.timeStampUtc}>
                                        <TableCell className="font-mono text-xs">{r.timeStampUtc}</TableCell>
                                        <TableCell className="break-all font-mono text-xs">{r.valueText ?? ""}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : null}
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

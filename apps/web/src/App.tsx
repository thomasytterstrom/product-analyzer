import { useEffect, useState } from "react";

import { createApiClient } from "./lib/api";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";

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
  const [fields, setFields] = useState<
    Array<{ fieldKey: string; valueText: string; valueType: string }>
  >([]);
  const [compareFields, setCompareFields] = useState<
    Array<{ fieldKey: string; valueText: string; valueType: string }>
  >([]);

  const [diffLoading, setDiffLoading] = useState(false);
  const [diffRows, setDiffRows] = useState<
    Array<{ fieldKey: string; aValue: string | null; bValue: string | null }>
  >([]);

  const [trendSnapshotIds, setTrendSnapshotIds] = useState<string[]>([]);
  const [trendFieldKey, setTrendFieldKey] = useState<string>("");
  const [trendRows, setTrendRows] = useState<Array<{ timeStampUtc: string; valueText: string | null }>>(
    []
  );
  const [trendLoading, setTrendLoading] = useState(false);

  const numericTrendPoints = trendRows
    .map((r) => {
      const raw = r.valueText ?? "";
      const n = Number.parseFloat(String(raw));
      return {
        timeStampUtc: r.timeStampUtc,
        valueText: r.valueText,
        valueNumber: Number.isFinite(n) ? n : null
      };
    })
    .filter((p) => p.valueNumber !== null);

  const configurationId =
    fields.find((f) => f.fieldKey === "root/ConfigurationId")?.valueText?.trim() ?? "";

  const compareConfigurationId =
    compareFields.find((f) => f.fieldKey === "root/ConfigurationId")?.valueText?.trim() ?? "";

  const [configurationFields, setConfigurationFields] = useState<
    Array<{ configurationId: string; fieldKey: string; tracked: boolean; friendlyName: string | null }>
  >([]);
  const [configurationFieldsLoading, setConfigurationFieldsLoading] = useState(false);
  const [configurationFieldsSaving, setConfigurationFieldsSaving] = useState(false);

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

      setTrendSnapshotIds([]);
      setTrendFieldKey("");
      setTrendRows([]);
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

      setTrendSnapshotIds([]);
      setTrendFieldKey("");
      setTrendRows([]);
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

      setTrendSnapshotIds([]);
      setTrendFieldKey("");
      setTrendRows([]);
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

        setTrendSnapshotIds([]);
        setTrendFieldKey("");
        setTrendRows([]);
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
    if (!trendFieldKey) return;
    if (trendSnapshotIds.length === 0) return;
    if (!selectedProductNumber || !selectedSerialNumber) return;

    const api = createApiClient({ baseUrl: "" });
    setTrendLoading(true);
    try {
      const series = await api.getTimeSeries({
        productNumber: selectedProductNumber,
        serialNumber: selectedSerialNumber,
        snapshotIds: trendSnapshotIds,
        fieldKeys: [trendFieldKey]
      });

      const first = series[0];
      const points = (first?.points ?? []).map((p) => ({
        timeStampUtc: p.timeStampUtc,
        valueText: p.valueText
      }));

      points.sort((a, b) => a.timeStampUtc.localeCompare(b.timeStampUtc));
      setTrendRows(points);
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
    } finally {
      setConfigurationFieldsSaving(false);
    }
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
                          onClick={() => setCompareDeviceSnapshotId(s.deviceSnapshotId)}
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

        <Card>
          <CardHeader>
            <CardTitle>Field discovery</CardTitle>
            <CardDescription>Inspect the fields present in snapshot A.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedDeviceSnapshotId ? (
              <p className="text-sm text-muted-foreground">Select a snapshot to discover fields.</p>
            ) : fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fields loaded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Field</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-[8rem]">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f) => (
                    <TableRow key={f.fieldKey}>
                      <TableCell className="font-mono text-xs">{f.fieldKey}</TableCell>
                      <TableCell className="break-all">{f.valueText}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.valueType}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracked fields</CardTitle>
            <CardDescription>
              Choose which fields to track (per ConfigurationId). Tracked fields drive Diff and Trends.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedDeviceSnapshotId ? (
              <p className="text-sm text-muted-foreground">Select a snapshot to edit tracked fields.</p>
            ) : !configurationId ? (
              <p className="text-sm text-muted-foreground">
                This snapshot has no ConfigurationId field. (Expected key: <span className="font-mono">root/ConfigurationId</span>)
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">ConfigurationId:</span>
                  <Badge variant="outline" className="max-w-[30rem] truncate" title={configurationId}>
                    {configurationId}
                  </Badge>
                </div>

                {configurationFieldsLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

                {!configurationFieldsLoading && configurationFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No fields discovered yet. Select a snapshot to discover fields, then choose which ones to track.
                  </p>
                ) : null}

                {configurationFields.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field key</TableHead>
                        <TableHead className="w-[9rem]">Tracked</TableHead>
                        <TableHead>Friendly name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configurationFields.map((row) => (
                        <TableRow key={row.fieldKey}>
                          <TableCell className="font-mono text-xs">{row.fieldKey}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                aria-label={`Tracked ${row.fieldKey}`}
                                checked={row.tracked}
                                onChange={(e) => {
                                  const checked = (e.target as HTMLInputElement).checked;
                                  setConfigurationFields((prev) =>
                                    prev.map((p) =>
                                      p.fieldKey === row.fieldKey ? { ...p, tracked: checked } : p
                                    )
                                  );
                                }}
                              />
                              <span className="text-xs text-muted-foreground">Track</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label={`Friendly name ${row.fieldKey}`}
                              value={row.friendlyName ?? ""}
                              placeholder="Optional"
                              onChange={(e) => {
                                const value = e.target.value;
                                setConfigurationFields((prev) =>
                                  prev.map((p) =>
                                    p.fieldKey === row.fieldKey ? { ...p, friendlyName: value } : p
                                  )
                                );
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void saveTrackedFields()}
                    disabled={configurationFieldsSaving || configurationFieldsLoading}
                  >
                    {configurationFieldsSaving ? "Saving…" : "Save tracked fields"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
                      <TableCell className="font-medium">{trackedFriendlyNameByKey.get(r.fieldKey) ?? r.fieldKey}</TableCell>
                      <TableCell className="break-all font-mono text-xs">{r.aValue ?? ""}</TableCell>
                      <TableCell className="break-all font-mono text-xs">{r.bValue ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
                              {s.snapshotId} <span className="text-xs text-muted-foreground">({s.timeStampUtc})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Trend field</span>
                  <select
                    aria-label="Trend field"
                    value={trendFieldKey}
                    onChange={(e) => setTrendFieldKey(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select…</option>
                    {trackedFieldKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>

                {trackedFieldKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    To pick trend fields, first mark one or more fields as <em>Tracked</em> in the Tracked fields section.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void showTrend()}
                    disabled={trendLoading || trendSnapshotIds.length === 0 || !trendFieldKey}
                  >
                    {trendLoading ? "Loading…" : "Show trend"}
                  </Button>
                </div>

                {trendRows.length > 0 ? (
                  <div className="space-y-3">
                    {numericTrendPoints.length >= 2 ? (
                      (() => {
                        const width = 640;
                        const height = 200;
                        const padX = 24;
                        const padY = 24;

                        const values = numericTrendPoints.map((p) => p.valueNumber as number);
                        let minY = Math.min(...values);
                        let maxY = Math.max(...values);
                        if (minY === maxY) {
                          minY -= 1;
                          maxY += 1;
                        }

                        const plotW = width - padX * 2;
                        const plotH = height - padY * 2;
                        const stepX = numericTrendPoints.length <= 1 ? 0 : plotW / (numericTrendPoints.length - 1);

                        const points = numericTrendPoints.map((p, idx) => {
                          const x = padX + idx * stepX;
                          const t = ((p.valueNumber as number) - minY) / (maxY - minY);
                          const y = padY + (1 - t) * plotH;
                          return { x, y };
                        });

                        const d = points
                          .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
                          .join(" ");

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

                              {/* line */}
                              <path d={d} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
                              {points.map((pt, idx) => (
                                <circle
                                  key={idx}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="4"
                                  fill="currentColor"
                                  opacity="0.95"
                                />
                              ))}
                            </svg>
                          </div>
                        );
                      })()
                    ) : null}

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
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

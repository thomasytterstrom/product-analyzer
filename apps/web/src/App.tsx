import { useEffect, useState } from "react";

import { createApiClient } from "./lib/api";

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

  const [trendSnapshotIds, setTrendSnapshotIds] = useState<string[]>([]);
  const [trendFieldKey, setTrendFieldKey] = useState<string>("");
  const [trendRows, setTrendRows] = useState<Array<{ timeStampUtc: string; valueText: string | null }>>(
    []
  );
  const [trendLoading, setTrendLoading] = useState(false);

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

  const aValueByKey = new Map(fields.map((f) => [f.fieldKey, f.valueText] as const));
  const bValueByKey = new Map(compareFields.map((f) => [f.fieldKey, f.valueText] as const));

  const diffRows = trackedFieldKeys
    .map((fieldKey) => {
      const aValue = aValueByKey.get(fieldKey) ?? null;
      const bValue = bValueByKey.get(fieldKey) ?? null;
      return {
        fieldKey,
        label: trackedFriendlyNameByKey.get(fieldKey) ?? fieldKey,
        aValue,
        bValue
      };
    })
    .filter((r) => r.aValue !== r.bValue);

  async function showTrend() {
    if (!trendFieldKey) return;
    if (trendSnapshotIds.length === 0) return;

    const api = createApiClient({ baseUrl: "" });
    setTrendLoading(true);
    try {
      const snapshotById = new Map(snapshots.map((s) => [s.deviceSnapshotId, s] as const));

      const points = await Promise.all(
        trendSnapshotIds.map(async (deviceSnapshotId) => {
          const snap = snapshotById.get(deviceSnapshotId);
          const timeStampUtc = snap?.timeStampUtc ?? "";

          // Reuse already loaded fields for snapshot A/B when possible.
          const fs =
            deviceSnapshotId === selectedDeviceSnapshotId
              ? fields
              : deviceSnapshotId === compareDeviceSnapshotId
                ? compareFields
                : await api.getSnapshotFields(deviceSnapshotId);

          const v = fs.find((f) => f.fieldKey === trendFieldKey)?.valueText ?? null;
          return { timeStampUtc, valueText: v };
        })
      );

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
    <div style={{ padding: 16 }}>
      <h1>Product Analyzer</h1>

      <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
        <label>
          Product number
          <select
            aria-label="Product number"
            value={selectedProductNumber}
            onChange={(e) => setSelectedProductNumber(e.target.value)}
          >
            <option value="">Select…</option>
            {productNumbers.map((pn) => (
              <option key={pn} value={pn}>
                {pn}
              </option>
            ))}
          </select>
        </label>

        <label>
          Serial number
          <select
            aria-label="Serial number"
            value={selectedSerialNumber}
            onChange={(e) => setSelectedSerialNumber(e.target.value)}
            disabled={!selectedProductNumber}
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

      {snapshots.length > 0 ? (
        <div>
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <div>
              <strong>A (view)</strong>: {selectedDeviceSnapshotId || "(select a snapshot)"}
            </div>
            <div>
              <strong>B (compare)</strong>: {compareDeviceSnapshotId || "(click Compare on another snapshot)"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Tip: click a snapshot to view it as A, then click <em>Compare</em> on another snapshot to set B.
            </div>
          </div>

          <ul>
          {snapshots.map((s) => (
            <li key={s.deviceSnapshotId}>
              <button
                type="button"
                onClick={() => setSelectedDeviceSnapshotId(s.deviceSnapshotId)}
              >
                {s.snapshotId} — {s.timeStampUtc}
              </button>

              <button
                type="button"
                aria-label={`Compare ${s.snapshotId}`}
                onClick={() => setCompareDeviceSnapshotId(s.deviceSnapshotId)}
                style={{ marginLeft: 8 }}
                disabled={!selectedDeviceSnapshotId}
              >
                Compare
              </button>
            </li>
          ))}
          </ul>
        </div>
      ) : null}

      {fields.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.fieldKey}>
                <td>{f.fieldKey}</td>
                <td>{f.valueText}</td>
                <td>{f.valueType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {selectedDeviceSnapshotId && configurationId ? (
        <div style={{ marginTop: 16 }}>
          <h2>Tracked fields</h2>
          <div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
            <div>
              <strong>ConfigurationId:</strong> {configurationId}
            </div>

            {configurationFieldsLoading ? <div>Loading…</div> : null}

            {!configurationFieldsLoading && configurationFields.length === 0 ? (
              <div>
                No fields discovered yet. Select a snapshot to discover fields, then choose which ones to track.
              </div>
            ) : null}

            {configurationFields.map((row) => (
              <div
                key={row.fieldKey}
                style={{ display: "grid", gap: 4, padding: 8, border: "1px solid #ddd" }}
              >
                <div>{row.fieldKey}</div>

                <label>
                  <input
                    type="checkbox"
                    aria-label={`Tracked ${row.fieldKey}`}
                    checked={row.tracked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setConfigurationFields((prev) =>
                        prev.map((p) =>
                          p.fieldKey === row.fieldKey ? { ...p, tracked: checked } : p
                        )
                      );
                    }}
                  />
                  Tracked
                </label>

                <label>
                  Friendly name
                  <input
                    aria-label={`Friendly name ${row.fieldKey}`}
                    value={row.friendlyName ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfigurationFields((prev) =>
                        prev.map((p) =>
                          p.fieldKey === row.fieldKey ? { ...p, friendlyName: value } : p
                        )
                      );
                    }}
                  />
                </label>
              </div>
            ))}

            <button
              type="button"
              onClick={() => void saveTrackedFields()}
              disabled={configurationFieldsSaving || configurationFieldsLoading}
            >
              {configurationFieldsSaving ? "Saving…" : "Save tracked fields"}
            </button>
          </div>
        </div>
      ) : null}

      {selectedDeviceSnapshotId && compareDeviceSnapshotId ? (
        <div style={{ marginTop: 16 }}>
          <h2>Diff</h2>

          {configurationId && compareConfigurationId && configurationId !== compareConfigurationId ? (
            <div>
              Cannot diff snapshots with different ConfigurationId ({configurationId} vs {compareConfigurationId}).
            </div>
          ) : trackedFieldKeys.length === 0 ? (
            <div>
              No tracked fields configured for this ConfigurationId. Mark fields as tracked above, then compare again.
            </div>
          ) : diffRows.length === 0 ? (
            <div>No changes across tracked fields.</div>
          ) : (
            <table aria-label="Diff">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>A</th>
                  <th>B</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map((r) => (
                  <tr key={r.fieldKey}>
                    <td>{r.label}</td>
                    <td>{r.aValue ?? ""}</td>
                    <td>{r.bValue ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {selectedDeviceSnapshotId && configurationId ? (
        <div style={{ marginTop: 16 }}>
          <h2>Trends</h2>

          <div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
            <div>
              <strong>Include snapshots</strong>
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              {snapshots.map((s) => {
                const checked = trendSnapshotIds.includes(s.deviceSnapshotId);
                return (
                  <label key={s.deviceSnapshotId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      aria-label={`Include ${s.snapshotId}`}
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setTrendSnapshotIds((prev) =>
                          next
                            ? [...prev, s.deviceSnapshotId]
                            : prev.filter((id) => id !== s.deviceSnapshotId)
                        );
                      }}
                    />
                    {s.snapshotId} ({s.timeStampUtc})
                  </label>
                );
              })}
            </div>

            <label>
              Trend field
              <select
                aria-label="Trend field"
                value={trendFieldKey}
                onChange={(e) => setTrendFieldKey(e.target.value)}
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
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                To pick trend fields, first mark one or more fields as <em>Tracked</em> in the Tracked fields section.
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void showTrend()}
              disabled={trendLoading || trendSnapshotIds.length === 0 || !trendFieldKey}
            >
              {trendLoading ? "Loading…" : "Show trend"}
            </button>

            {trendRows.length > 0 ? (
              <table aria-label="Trend">
                <thead>
                  <tr>
                    <th>TimeStampUtc</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {trendRows.map((r) => (
                    <tr key={r.timeStampUtc}>
                      <td>{r.timeStampUtc}</td>
                      <td>{r.valueText ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

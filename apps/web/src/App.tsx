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

  const configurationId =
    fields.find((f) => f.fieldKey === "root/ConfigurationId")?.valueText?.trim() ?? "";

  const compareConfigurationId =
    compareFields.find((f) => f.fieldKey === "root/ConfigurationId")?.valueText?.trim() ?? "";

  const [configurationFields, setConfigurationFields] = useState<
    Array<{ configurationId: string; fieldKey: string; tracked: boolean; friendlyName: string | null }>
  >([]);
  const [configurationFieldsLoading, setConfigurationFieldsLoading] = useState(false);
  const [configurationFieldsSaving, setConfigurationFieldsSaving] = useState(false);

  useEffect(() => {
    const api = createApiClient({ baseUrl: "" });
    void api.listProductNumbers().then(setProductNumbers);
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
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    void api.listSerialNumbers(selectedProductNumber).then((sns) => {
      setSerialNumbers(sns);
      setSelectedSerialNumber("");
      setSnapshots([]);
      setSelectedDeviceSnapshotId("");
      setCompareDeviceSnapshotId("");
      setFields([]);
      setCompareFields([]);
    });
  }, [selectedProductNumber]);

  useEffect(() => {
    if (!selectedProductNumber || !selectedSerialNumber) {
      setSnapshots([]);
      setSelectedDeviceSnapshotId("");
      setCompareDeviceSnapshotId("");
      setFields([]);
      setCompareFields([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    void api
      .listSnapshots({
        productNumber: selectedProductNumber,
        serialNumber: selectedSerialNumber
      })
      .then((ss) => {
        setSnapshots(ss);
        setSelectedDeviceSnapshotId("");
        setCompareDeviceSnapshotId("");
        setFields([]);
        setCompareFields([]);
      });
  }, [selectedProductNumber, selectedSerialNumber]);

  useEffect(() => {
    if (!selectedDeviceSnapshotId) {
      setFields([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    void api.getSnapshotFields(selectedDeviceSnapshotId).then(setFields);
  }, [selectedDeviceSnapshotId]);

  useEffect(() => {
    if (!compareDeviceSnapshotId) {
      setCompareFields([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    void api.getSnapshotFields(compareDeviceSnapshotId).then(setCompareFields);
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

  useEffect(() => {
    if (!configurationId) {
      setConfigurationFields([]);
      setConfigurationFieldsLoading(false);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    setConfigurationFieldsLoading(true);
    void api
      .getConfigurationFields(configurationId)
      .then(setConfigurationFields)
      .finally(() => setConfigurationFieldsLoading(false));
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
              <div>No configuration fields found.</div>
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
            <div>No tracked fields configured for this ConfigurationId.</div>
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
    </div>
  );
}

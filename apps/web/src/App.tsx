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

  useEffect(() => {
    const api = createApiClient({ baseUrl: "" });
    void api.listProductNumbers().then(setProductNumbers);
  }, []);

  useEffect(() => {
    if (!selectedProductNumber) {
      setSerialNumbers([]);
      setSelectedSerialNumber("");
      setSnapshots([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    void api.listSerialNumbers(selectedProductNumber).then((sns) => {
      setSerialNumbers(sns);
      setSelectedSerialNumber("");
      setSnapshots([]);
    });
  }, [selectedProductNumber]);

  useEffect(() => {
    if (!selectedProductNumber || !selectedSerialNumber) {
      setSnapshots([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    void api
      .listSnapshots({
        productNumber: selectedProductNumber,
        serialNumber: selectedSerialNumber
      })
      .then(setSnapshots);
  }, [selectedProductNumber, selectedSerialNumber]);

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
              {s.snapshotId} — {s.timeStampUtc}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

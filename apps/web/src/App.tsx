import { useEffect, useState } from "react";

import { createApiClient } from "./lib/api";

export default function App() {
  const [productNumbers, setProductNumbers] = useState<string[]>([]);
  const [selectedProductNumber, setSelectedProductNumber] = useState<string>("");
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);

  useEffect(() => {
    const api = createApiClient({ baseUrl: "" });
    void api.listProductNumbers().then(setProductNumbers);
  }, []);

  useEffect(() => {
    if (!selectedProductNumber) {
      setSerialNumbers([]);
      return;
    }

    const api = createApiClient({ baseUrl: "" });
    void api.listSerialNumbers(selectedProductNumber).then(setSerialNumbers);
  }, [selectedProductNumber]);

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
      </div>

      {serialNumbers.length > 0 ? (
        <ul>
          {serialNumbers.map((sn) => (
            <li key={sn}>{sn}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

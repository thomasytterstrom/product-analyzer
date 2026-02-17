import { describe, expect, it } from "vitest";
import { flattenSnapshotJson } from "./flatten";

describe("flattenSnapshotJson", () => {
  it("flattens node, composite, and selected root fields", () => {
    const snapshot = {
      FirmwareVersion: "599807801M",
      ConfigurationId: "Construction.RemoteControl.Corea",
      TimeStamp: "2026-02-17T07:50:23.9370956Z",
      Nodes: [
        {
          NodeId: "master",
          Parameters: [
            {
              FieldId: "send.command.Response.status",
              Value: "OK",
              Type: "string"
            },
            {
              FieldId: "identities.writeMachineType.Response.status",
              Value: null,
              Type: "string"
            }
          ],
          Nodes: []
        }
      ],
      CompositeParameters: [
        {
          FieldId: "Identities.ParseHid.Response.ProductNumber",
          Value: "531285301",
          Type: "string"
        }
      ]
    };

    const flat = flattenSnapshotJson(snapshot);

    expect(flat["node:master/send.command.Response.status"]).toEqual({
      valueText: "OK",
      valueType: "string"
    });

    expect(flat["composite/Identities.ParseHid.Response.ProductNumber"]).toEqual({
      valueText: "531285301",
      valueType: "string"
    });

    expect(flat["root/FirmwareVersion"]).toEqual({
      valueText: "599807801M",
      valueType: "string"
    });

    expect(flat["root/ConfigurationId"]).toEqual({
      valueText: "Construction.RemoteControl.Corea",
      valueType: "string"
    });

    expect(flat["root/TimeStamp"]).toEqual({
      valueText: "2026-02-17T07:50:23.9370956Z",
      valueType: "string"
    });

    expect(flat["node:master/identities.writeMachineType.Response.status"]).toEqual({
      valueText: null,
      valueType: "string"
    });
  });
});

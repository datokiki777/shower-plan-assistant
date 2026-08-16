import { describe, expect, it } from "vitest";
import { jobFormToPersistedFields, jobToFormValues, JOB_FORM_DEFAULTS } from "./schema";

describe("job form transforms", () => {
  it("splits multiline textarea text into a trimmed, non-empty string array", () => {
    const fields = jobFormToPersistedFields({
      ...JOB_FORM_DEFAULTS,
      clientId: "c1",
      groupId: "g1",
      installablesText: "Mischbatterie\n  Brauseset  \n\nRegendusche\n"
    });
    expect(fields.installables).toEqual(["Mischbatterie", "Brauseset", "Regendusche"]);
  });

  it('empty textarea produces an empty array, not [""]', () => {
    const fields = jobFormToPersistedFields({ ...JOB_FORM_DEFAULTS, clientId: "c1", groupId: "g1" });
    expect(fields.installables).toEqual([]);
    expect(fields.extraWork).toEqual([]);
    expect(fields.workNotes).toEqual([]);
    expect(fields.glassPartitionSize).toEqual([]);
  });

  it("empty jobDate/jobDurationDays become null, not empty string/NaN", () => {
    const fields = jobFormToPersistedFields({ ...JOB_FORM_DEFAULTS, clientId: "c1", groupId: "g1" });
    expect(fields.jobDate).toBeNull();
    expect(fields.jobDurationDays).toBeNull();
  });

  it("jobDurationDays parses to a number", () => {
    const fields = jobFormToPersistedFields({ ...JOB_FORM_DEFAULTS, clientId: "c1", groupId: "g1", jobDurationDays: "3" });
    expect(fields.jobDurationDays).toBe(3);
  });

  it("jobToFormValues -> jobFormToPersistedFields round-trips array fields correctly", () => {
    const original = {
      clientId: "c1",
      groupId: "g1",
      jobDate: "2026-08-15",
      jobDurationDays: 2,
      packageType: "S",
      antiSlip: "დიახ",
      showerTraySize: "90x90",
      glassPartitionSize: ["შუშა 100 სმ.", "შუშა 90 სმ."],
      hingedDoorSize: "PK1-90",
      panelColor: "AMPARA",
      floorPanelColor: "",
      panelHeight: "",
      installables: ["Mischbatterie", "Brauseset"],
      extraWork: ["სახეხი 80 სმ."],
      workNotes: []
    };
    const formValues = jobToFormValues(original);
    const roundTripped = jobFormToPersistedFields(formValues);
    expect(roundTripped).toMatchObject(original);
  });
});

import { Lead, LeadDoc } from "../../models/Lead";
import { ZohoIntegrationDoc, ZohoFieldMeta } from "../../models/ZohoIntegration";
import { fetchLeadFields, fetchLeadsPage, fetchLeadCustomViews, fetchViewLeadIds, ZohoLeadRecord, ZohoCustomView } from "./zohoClient";
import { LeadList } from "../../models/LeadList";
import { normalizePhone, phoneKey } from "../../utils/phone";

const STANDARD_MAP: Record<string, keyof LeadDoc> = {
  First_Name: "firstName",
  Last_Name: "lastName",
  Email: "email",
  Phone: "phone",
  Mobile: "mobile",
  Company: "company",
  Designation: "title",
  Lead_Status: "leadStatus",
  Lead_Source: "leadSource",
  City: "city",
  State: "state",
  Country: "country",
  Industry: "industry",
  Website: "website",
  Description: "description",
  Rating: "rating",
  Annual_Revenue: "annualRevenue",
};

function scalar(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if ("name" in o) return o.name; // lookup / owner
    if ("display_value" in o) return o.display_value;
    return v;
  }
  return v;
}

export function mapZohoRecordToLead(rec: ZohoLeadRecord, fields: ZohoFieldMeta[]): Partial<LeadDoc> & { fields: Record<string, unknown> } {
  const flat: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.api_name in rec) flat[f.api_name] = scalar(rec[f.api_name]);
  }
  for (const [k, v] of Object.entries(rec)) if (!(k in flat) && k !== "id") flat[k] = scalar(v);

  const out: Partial<LeadDoc> & { fields: Record<string, unknown> } = { fields: flat };
  for (const [zohoKey, localKey] of Object.entries(STANDARD_MAP)) {
    const v = flat[zohoKey];
    if (v !== undefined && v !== null && v !== "") (out as any)[localKey] = v;
  }
  const first = (flat.First_Name as string) || "";
  const last = (flat.Last_Name as string) || "";
  out.fullName = (flat.Full_Name as string) || `${first} ${last}`.trim() || (flat.Company as string) || (flat.Email as string) || "Unnamed lead";
  const phoneRaw = (flat.Phone as string) || (flat.Mobile as string) || "";
  out.phone = normalizePhone(phoneRaw) ?? (phoneRaw || undefined);
  out.phoneKey = phoneKey(phoneRaw) ?? undefined;
  if (flat.Mobile) out.mobile = normalizePhone(flat.Mobile as string) ?? (flat.Mobile as string);
  if (rec.Modified_Time) out.zohoModifiedTime = new Date(rec.Modified_Time as string);
  return out;
}

export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  lists?: number;
  durationMs: number;
}

function viewColumns(v: ZohoCustomView): string[] {
  return (v.fields ?? []).map((f) => (typeof f === "string" ? f : f.api_name)).filter(Boolean);
}

/** Mirror Zoho custom views of the Leads module as LeadList docs and refresh membership. */
export async function syncZohoLeadLists(workspaceId: string, integ: ZohoIntegrationDoc): Promise<number> {
  const views = await fetchLeadCustomViews(integ);
  const seen: string[] = [];
  for (const v of views) {
    const ids = await fetchViewLeadIds(integ, v.id);
    const list = await LeadList.findOneAndUpdate(
      { workspaceId, zohoCvId: v.id },
      {
        $set: {
          source: "zoho",
          name: v.display_value || v.name,
          systemName: v.system_name,
          category: v.category,
          isDefault: Boolean(v.default),
          columns: viewColumns(v),
          criteria: v.criteria ?? null,
          recordCount: ids.length,
          lastSyncAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    const listId = String(list._id);
    seen.push(listId);
    if (ids.length) await Lead.updateMany({ workspaceId, zohoId: { $in: ids } }, { $addToSet: { listIds: listId } });
    await Lead.updateMany({ workspaceId, listIds: listId, ...(ids.length ? { zohoId: { $nin: ids } } : {}) }, { $pull: { listIds: listId } });
  }
  // views deleted in Zoho
  const stale = await LeadList.find({ workspaceId, source: "zoho", _id: { $nin: seen } });
  for (const st of stale) {
    await Lead.updateMany({ workspaceId, listIds: String(st._id) }, { $pull: { listIds: String(st._id) } });
    await st.deleteOne();
  }
  return seen.length;
}

export async function syncZohoLeads(workspaceId: string, integ: ZohoIntegrationDoc, opts: { full?: boolean } = {}): Promise<SyncResult> {
  const started = Date.now();
  integ.syncStatus = "running";
  integ.syncError = undefined;
  await integ.save();
  try {
    const fields = await fetchLeadFields(integ);
    const wanted = fields.filter((f) => !["subform", "fileupload", "imageupload", "profileimage"].includes(f.data_type)).map((f) => f.api_name);
    const since = !opts.full && integ.lastSyncAt ? new Date(integ.lastSyncAt.getTime() - 5 * 60 * 1000) : undefined;

    let page = 1;
    let fetched = 0;
    let created = 0;
    let updated = 0;
    for (;;) {
      const { records, moreRecords } = await fetchLeadsPage(integ, wanted, page, 200, since);
      for (const rec of records) {
        fetched++;
        const mapped = mapZohoRecordToLead(rec, fields);
        const existing = await Lead.findOne({ workspaceId, zohoId: rec.id });
        if (existing) {
          // keep locally-collected values that Zoho still has empty
          const mergedFields = { ...existing.fields };
          for (const [k, v] of Object.entries(mapped.fields)) {
            if (v !== null && v !== undefined && v !== "") mergedFields[k] = v;
            else if (!(k in mergedFields)) mergedFields[k] = v;
          }
          Object.assign(existing, { ...mapped, fields: mergedFields, syncedAt: new Date(), source: "zoho" });
          await existing.save();
          updated++;
        } else {
          await Lead.create({ workspaceId, source: "zoho", zohoId: rec.id, ...mapped, syncedAt: new Date() });
          created++;
        }
      }
      if (!moreRecords || records.length === 0 || page > 500) break;
      page++;
    }
    let lists = 0;
    try {
      lists = await syncZohoLeadLists(workspaceId, integ);
    } catch (err) {
      console.warn("[zoho] custom view sync failed (leads still synced):", (err as Error).message);
    }
    integ.syncStatus = "idle";
    integ.lastSyncAt = new Date();
    integ.lastSyncStats = { fetched, created, updated, lists, durationMs: Date.now() - started };
    await integ.save();
    return integ.lastSyncStats;
  } catch (err) {
    integ.syncStatus = "error";
    integ.syncError = (err as Error).message;
    await integ.save();
    throw err;
  }
}

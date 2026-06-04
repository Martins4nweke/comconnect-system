import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  assertCanExportData,
  getScopedContext,
  type ScopedContext,
} from "@/lib/comconnect-core/access-scope";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import JSZip from "jszip";

export const runtime = "nodejs";

type ExportFormat = "csv" | "xlsx" | "pdf" | "json" | "zip";

type DatasetConfig = {
  label: string;
  table: string;
  dateColumn?: string;
  statusColumn?: string;
  archivedColumn?: string;
  defaultOrder?: string;
  scope: "project" | "organisation";
};

const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 50000;
const MAX_ZIP_FILES = 50;

const DATASETS: Record<string, DatasetConfig> = {
  participants: {
    label: "Participants",
    table: "participants",
    dateColumn: "created_at",
    statusColumn: "status",
    archivedColumn: "archived_at",
    scope: "project",
  },
  app_messages: {
    label: "App Messages",
    table: "app_messages",
    dateColumn: "created_at",
    statusColumn: "status",
    archivedColumn: "archived_at",
    scope: "project",
  },
  app_message_replies: {
    label: "App Message Replies",
    table: "app_message_replies",
    dateColumn: "created_at",
    scope: "project",
  },
  central_inbox: {
    label: "Central Inbox",
    table: "inbox_items",
    dateColumn: "created_at",
    statusColumn: "status",
    archivedColumn: "archived_at",
    scope: "project",
  },
  delivery_events: {
    label: "Delivery Logs",
    table: "communication_delivery_events",
    dateColumn: "created_at",
    statusColumn: "status",
    scope: "project",
  },
  chat_threads: {
    label: "Chat Threads",
    table: "chat_threads",
    dateColumn: "created_at",
    statusColumn: "status",
    scope: "project",
  },
  chat_messages: {
    label: "Chat Messages",
    table: "chat_messages",
    dateColumn: "created_at",
    scope: "project",
  },
  appointments: {
    label: "Appointments",
    table: "appointments",
    dateColumn: "created_at",
    statusColumn: "status",
    archivedColumn: "archived_at",
    scope: "project",
  },
  referrals: {
    label: "Referrals",
    table: "referrals",
    dateColumn: "created_at",
    statusColumn: "status",
    archivedColumn: "archived_at",
    scope: "project",
  },
  health_checkins: {
    label: "Health Check-ins",
    table: "health_observations",
    dateColumn: "submitted_at",
    statusColumn: "status",
    archivedColumn: "archived_at",
    scope: "project",
  },
  voice_tasks: {
    label: "Voice Tasks",
    table: "voice_call_tasks",
    dateColumn: "created_at",
    statusColumn: "status",
    scope: "project",
  },
  audit_logs: {
    label: "Audit Logs",
    table: "audit_logs",
    dateColumn: "created_at",
    scope: "organisation",
  },
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function safeFileName(value: string) {
  return cleanText(value)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? DEFAULT_LIMIT);

  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function flattenValue(value: any): any {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;

  return JSON.stringify(value);
}

function flattenRows(rows: any[]) {
  return rows.map((row) => {
    const output: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      output[key] = flattenValue(value);
    }

    return output;
  });
}

function toCsv(rows: any[]) {
  const flat = flattenRows(rows);

  if (flat.length === 0) return "";

  const headerSet = new Set<string>();

  for (const row of flat) {
    for (const key of Object.keys(row)) {
      headerSet.add(key);
    }
  }

  const headers = Array.from(headerSet);

  const escapeCsv = (value: any) => {
    const text = String(value ?? "");

    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  return [
    headers.join(","),
    ...flat.map((row) =>
      headers.map((header) => escapeCsv(row[header])).join(",")
    ),
  ].join("\n");
}

function excelBuffer(rows: any[], sheetName: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(flattenRows(rows));

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
}

function pdfBuffer(rows: any[], title: string, dataset: string) {
  const doc = new jsPDF();
  const now = new Date().toLocaleString();

  doc.setFontSize(16);
  doc.text(title, 14, 18);

  doc.setFontSize(10);
  doc.text(`Dataset: ${dataset}`, 14, 28);
  doc.text(`Generated: ${now}`, 14, 35);
  doc.text(`Rows included: ${rows.length}`, 14, 42);

  const counts: Record<string, number> = {};

  for (const row of rows) {
    const key =
      row.status ??
      row.priority ??
      row.source_type ??
      row.channel ??
      "records";

    counts[String(key)] = (counts[String(key)] ?? 0) + 1;
  }

  let y = 55;

  doc.setFontSize(12);
  doc.text("Summary", 14, y);
  y += 8;

  doc.setFontSize(10);

  for (const [key, count] of Object.entries(counts).slice(0, 30)) {
    doc.text(`${key}: ${count}`, 18, y);
    y += 7;

    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  }

  y += 6;

  doc.setFontSize(12);
  doc.text("Sample rows", 14, y);
  y += 8;

  doc.setFontSize(8);

  for (const row of rows.slice(0, 25)) {
    const preview =
      row.title ??
      row.summary ??
      row.participant_code ??
      row.message_text ??
      row.status ??
      row.id ??
      "record";

    doc.text(String(preview).slice(0, 95), 18, y);
    y += 6;

    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function validateRequestedProject(context: ScopedContext, projectId: string) {
  if (!projectId) return null;

  if (!context.allowed_project_ids.includes(projectId)) {
    return "You do not have access to the selected project.";
  }

  return null;
}

function effectiveProjectId(context: ScopedContext, requestedProjectId: string) {
  return requestedProjectId || context.active_project_id || "";
}

async function getMediaManifest(params: {
  context: ScopedContext;
  projectId: string;
  start?: string;
  end?: string;
  limit: number;
  mediaType?: string;
}) {
  let query = supabaseAdmin
    .from("chat_messages")
    .select(
      "id, organisation_id, project_id, participant_id, thread_id, message_text, payload, created_at"
    )
    .eq("organisation_id", params.context.organisation_id)
    .order("created_at", { ascending: false })
    .limit(params.limit);

  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  } else if (!params.context.can_manage_organisation) {
    query = query.in("project_id", params.context.allowed_project_ids);
  }

  if (params.start) {
    query = query.gte("created_at", params.start);
  }

  if (params.end) {
    query = query.lte("created_at", params.end);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row: any) => row.payload?.media || row.payload?.media_type)
    .map((row: any) => {
      const media = row.payload?.media ?? row.payload ?? {};

      return {
        id: row.id,
        organisation_id: row.organisation_id,
        project_id: row.project_id,
        participant_id: row.participant_id,
        thread_id: row.thread_id,
        message_text: row.message_text,
        media_type:
          media.media_type ??
          row.payload?.media_type ??
          row.payload?.message_type ??
          "",
        bucket: media.bucket ?? media.storage_bucket ?? "",
        storage_path: media.storage_path ?? "",
        file_name: media.file_name ?? media.media_filename ?? "",
        mime_type: media.mime_type ?? media.media_mime_type ?? "",
        file_size: media.file_size ?? media.media_size ?? "",
        uploaded_at: media.uploaded_at ?? row.created_at,
        created_at: row.created_at,
      };
    })
    .filter((row: any) => {
      if (!params.mediaType || params.mediaType === "all") return true;

      return String(row.media_type).toLowerCase() === params.mediaType;
    });
}

async function zipMediaBuffer(rows: any[]) {
  const zip = new JSZip();
  const manifestRows: any[] = [];
  const selectedRows = rows.slice(0, MAX_ZIP_FILES);

  for (const row of selectedRows) {
    const bucket = cleanText(row.bucket);
    const storagePath = cleanText(row.storage_path);

    if (!bucket || !storagePath) {
      manifestRows.push({
        ...row,
        zip_status: "skipped",
        zip_error: "Missing bucket or storage_path",
      });
      continue;
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(storagePath);

    if (error || !data) {
      manifestRows.push({
        ...row,
        zip_status: "failed",
        zip_error: error?.message ?? "Could not download media file",
      });
      continue;
    }

    const arrayBuffer = await data.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const fallbackName = storagePath.split("/").pop() || `${row.id}.bin`;
    const safeName = safeFileName(row.file_name || fallbackName);
    const folder = safeFileName(row.media_type || "media") || "media";

    zip.file(`${folder}/${safeName}`, fileBuffer);

    manifestRows.push({
      ...row,
      zip_status: "included",
      zip_error: "",
    });
  }

  zip.file("manifest.csv", toCsv(manifestRows));

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });
}

async function getRows(req: NextRequest, context: ScopedContext) {
  const url = new URL(req.url);

  const dataset = cleanText(url.searchParams.get("dataset"));
  const requestedProjectId = cleanText(url.searchParams.get("project_id"));
  const status = cleanText(url.searchParams.get("status"));
  const start = cleanText(url.searchParams.get("start"));
  const end = cleanText(url.searchParams.get("end"));
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const limit = parseLimit(url.searchParams.get("limit"));
  const mediaType = cleanText(url.searchParams.get("media_type")).toLowerCase();

  const projectError = validateRequestedProject(context, requestedProjectId);
  if (projectError) throw new Error(projectError);

  const projectId = effectiveProjectId(context, requestedProjectId);

  if (dataset === "media_manifest") {
    const rows = await getMediaManifest({
      context,
      projectId,
      start,
      end,
      limit: Math.min(limit, MAX_ZIP_FILES),
      mediaType,
    });

    return {
      dataset,
      label: "Media Manifest",
      rows,
    };
  }

  const config = DATASETS[dataset];

  if (!config) {
    throw new Error(`Unsupported export dataset: ${dataset}`);
  }

  let query = supabaseAdmin
    .from(config.table)
    .select("*")
    .eq("organisation_id", context.organisation_id)
    .limit(limit);

  const orderColumn = config.defaultOrder ?? config.dateColumn ?? "created_at";

  query = query.order(orderColumn, { ascending: false });

  if (config.scope === "project") {
    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }
  }

  if (config.scope === "organisation" && requestedProjectId) {
    query = query.eq("project_id", requestedProjectId);
  }

  if (status && config.statusColumn) {
    query = query.eq(config.statusColumn, status);
  }

  if (!includeArchived && config.archivedColumn) {
    query = query.is(config.archivedColumn, null);
  }

  if (start && config.dateColumn) {
    query = query.gte(config.dateColumn, start);
  }

  if (end && config.dateColumn) {
    query = query.lte(config.dateColumn, end);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return {
    dataset,
    label: config.label,
    rows: data ?? [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const permissionError = assertCanExportData(context);

    if (permissionError) {
      return permissionError;
    }

    const url = new URL(req.url);
    const format = (cleanText(url.searchParams.get("format")) ||
      "csv") as ExportFormat;

    const { dataset, label, rows } = await getRows(req, context);
    const fileBase = safeFileName(
      `${label}_${new Date().toISOString().slice(0, 10)}`
    );

    if (format === "json") {
      return NextResponse.json({
        ok: true,
        data: {
          dataset,
          label,
          count: rows.length,
          scope: {
            organisation_id: context.organisation_id,
            project_id: effectiveProjectId(
              context,
              cleanText(url.searchParams.get("project_id"))
            ),
          },
          rows,
        },
      });
    }

    if (format === "xlsx") {
      const buffer = excelBuffer(rows, label);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
        },
      });
    }

    if (format === "pdf") {
      const buffer = pdfBuffer(rows, `${label} Export Summary`, dataset);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileBase}.pdf"`,
        },
      });
    }

    if (format === "zip") {
      if (dataset !== "media_manifest") {
        return NextResponse.json(
          {
            ok: false,
            error: "ZIP export is only supported for Media Manifest.",
          },
          { status: 400 }
        );
      }

      const buffer = await zipMediaBuffer(rows);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${fileBase}.zip"`,
        },
      });
    }

    const csv = toCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Export failed",
      },
      { status: 400 }
    );
  }
}
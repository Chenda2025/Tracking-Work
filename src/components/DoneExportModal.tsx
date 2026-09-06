"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { endOfMonth, format, parseISO } from "date-fns";
import { km } from "date-fns/locale";
import { toJpeg, toPng } from "html-to-image";
import { FileText, Image as ImageIcon } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  dataUrlToBytes,
  downloadBlob,
  jpegPagesToPdf,
  paginateItems,
  shareFileToTelegram,
} from "@/lib/a4Export";
import { useTrackingStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import {
  formatClock,
  formatShortDate,
  labelEventRepeatFrequency,
} from "@/lib/utils";

type MonthGroup = {
  key: string;
  monthLabel: string;
  lastDayLabel: string;
  lastDayISO: string;
  items: CalendarEvent[];
};

type ExportPage = {
  key: string;
  monthKey: string;
  monthLabel: string;
  lastDayLabel: string;
  pageIndex: number;
  pageCount: number;
  startNumber: number;
  items: CalendarEvent[];
  totalInMonth: number;
};

function eventWhen(item: CalendarEvent): string {
  if (item.allDay) return "ពេញថ្ងៃ";
  const start = item.startTime ? formatClock(item.startTime) : "";
  const end = item.endTime ? formatClock(item.endTime) : "";
  if (start && end) return `${start} – ${end}`;
  return start || "—";
}

function groupByMonth(items: CalendarEvent[]): MonthGroup[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const item of items) {
    const key = item.date.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupItems]) => {
      const anchor = parseISO(`${key}-01`);
      const last = endOfMonth(anchor);
      const sorted = [...groupItems].sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate) return byDate;
        return (a.startTime || "").localeCompare(b.startTime || "");
      });
      return {
        key,
        monthLabel: format(anchor, "MMMM yyyy", { locale: km }),
        lastDayLabel: format(last, "d MMMM yyyy", { locale: km }),
        lastDayISO: format(last, "yyyy-MM-dd"),
        items: sorted,
      };
    });
}

function buildExportPages(groups: MonthGroup[]): ExportPage[] {
  const pages: ExportPage[] = [];
  for (const group of groups) {
    const chunks = paginateItems(group.items);
    let startNumber = 1;
    chunks.forEach((chunk, pageIndex) => {
      pages.push({
        key: `${group.key}-${pageIndex}`,
        monthKey: group.key,
        monthLabel: group.monthLabel,
        lastDayLabel: group.lastDayLabel,
        pageIndex,
        pageCount: chunks.length,
        startNumber,
        items: chunk,
        totalInMonth: group.items.length,
      });
      startNumber += chunk.length;
    });
  }
  return pages.length ? pages : [];
}

function telegramText(
  groups: MonthGroup[],
  folderNameById: Record<string, string>
): string {
  const blocks = groups.map((group) => {
    const lines = group.items.map((item, index) => {
      const folder = item.folderId ? folderNameById[item.folderId] : "";
      const bits = [
        formatShortDate(item.date),
        eventWhen(item),
        item.location,
        folder,
      ].filter(Boolean);
      return `${index + 1}. ${item.title}\n${bits.join(" · ")}`;
    });
    return [
      `ខែ ${group.monthLabel}`,
      `ទៅថ្ងៃចុងខែ ${group.lastDayLabel}`,
      `${group.items.length} ព្រឹត្តិការណ៍`,
      "",
      ...lines,
    ].join("\n");
  });
  let text = ["ថេរ — ធ្វើរួចរាល់", "", ...blocks].join("\n");
  if (text.length > 3500) text = `${text.slice(0, 3480)}\n…`;
  return text;
}

export function DoneExportModal({
  open,
  items,
  folderNameById,
  onClose,
}: {
  open: boolean;
  items: CalendarEvent[];
  folderNameById: Record<string, string>;
  onClose: () => void;
}) {
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);
  const [error, setError] = useState("");
  const telegramSettings = useTrackingStore((s) => s.telegramSettings);

  const monthGroups = useMemo(() => groupByMonth(items), [items]);
  const pages = useMemo(() => buildExportPages(monthGroups), [monthGroups]);

  useEffect(() => {
    pageRefs.current = pageRefs.current.slice(0, pages.length);
  }, [pages.length]);

  function bindPage(index: number) {
    return (node: HTMLElement | null) => {
      pageRefs.current[index] = node;
    };
  }

  async function capturePages(kind: "jpeg" | "png") {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    const nodes = pageRefs.current.filter((node): node is HTMLElement => Boolean(node));
    const out: { dataUrl: string; width: number; height: number }[] = [];
    for (const node of nodes) {
      const dataUrl =
        kind === "jpeg"
          ? await toJpeg(node, {
              quality: 0.92,
              pixelRatio: 2,
              backgroundColor: "#ffffff",
              cacheBust: true,
              width: 794,
              height: 1123,
              style: { transform: "none", width: "794px", height: "1123px" },
            })
          : await toPng(node, {
              pixelRatio: 2,
              backgroundColor: "#ffffff",
              cacheBust: true,
              width: 794,
              height: 1123,
              style: { transform: "none", width: "794px", height: "1123px" },
            });
      out.push({
        dataUrl,
        width: Math.round(node.offsetWidth * 2) || 1588,
        height: Math.round(node.offsetHeight * 2) || 2246,
      });
    }
    return out;
  }

  async function run(kind: "pdf" | "image") {
    if (!items.length || busy) return;
    setBusy(kind);
    setError("");
    try {
      const text = telegramText(monthGroups, folderNameById);
      if (kind === "pdf") {
        const shots = await capturePages("jpeg");
        if (!shots.length) throw new Error("empty");
        const pdf = jpegPagesToPdf(
          shots.map((shot) => ({
            jpeg: dataUrlToBytes(shot.dataUrl),
            width: shot.width,
            height: shot.height,
          }))
        );
        const stamp = monthGroups[0]?.lastDayISO ?? format(new Date(), "yyyy-MM-dd");
        const file = new File([pdf], `done-${stamp}.pdf`, {
          type: "application/pdf",
        });
        await shareFileToTelegram(file, text, telegramSettings);
        return;
      }
      const shots = await capturePages("png");
      if (!shots.length) throw new Error("empty");
      const files = shots.map((shot, index) => {
        const page = pages[index];
        const stamp = page?.monthKey ?? format(new Date(), "yyyy-MM");
        const suffix = shots.length > 1 ? `-${index + 1}` : "";
        return new File([new Blob([dataUrlToBytes(shot.dataUrl)])], `done-${stamp}${suffix}.png`, {
          type: "image/png",
        });
      });
      await shareFileToTelegram(files[0], text, telegramSettings);
      for (let index = 1; index < files.length; index += 1) {
        if (telegramSettings.enabled && telegramSettings.botToken && telegramSettings.chatId) {
          await shareFileToTelegram(files[index], text, telegramSettings);
        } else {
          downloadBlob(files[index], files[index].name);
        }
      }
    } catch {
      setError("មិនអាចនាំចេញបាន");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} title="នាំចេញ" onClose={onClose}>
      <div className="export-done">
        <div className="export-preview-clip">
          {pages.map((page, pageIndex) => (
            <div className="export-a4-scale" key={page.key}>
              <article className="export-a4-page" ref={bindPage(pageIndex)}>
                <header className="export-a4-head">
                  <p className="export-a4-brand">ថេរ</p>
                  <h3 className="export-a4-title">ធ្វើរួចរាល់</h3>
                  <p className="export-a4-meta">
                    {page.monthLabel} · ទៅថ្ងៃចុងខែ {page.lastDayLabel}
                    {page.pageCount > 1
                      ? ` · ${page.pageIndex + 1}/${page.pageCount}`
                      : ""}
                  </p>
                </header>
                <ol className="export-a4-list">
                  {page.items.map((item, index) => {
                    const folder = item.folderId
                      ? folderNameById[item.folderId]
                      : "";
                    const repeat = labelEventRepeatFrequency(
                      item.repeatFrequency
                    );
                    return (
                      <li key={item.id} className="export-a4-item">
                        <span className="export-a4-num">
                          {page.startNumber + index}
                        </span>
                        <div className="export-a4-body">
                          <p className="export-a4-item-title">{item.title}</p>
                          <p className="export-a4-item-line">
                            {[
                              formatShortDate(item.date),
                              eventWhen(item),
                              item.location,
                              folder,
                              repeat,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <footer className="export-a4-foot">
                  {page.totalInMonth} ព្រឹត្តិការណ៍ · ទៅថ្ងៃចុងខែ {page.lastDayLabel}
                </footer>
              </article>
            </div>
          ))}
        </div>

        <div className="calendar-chooser export-done-actions">
          <button
            type="button"
            className="calendar-chooser-item"
            disabled={!items.length || Boolean(busy)}
            onClick={() => run("pdf")}
          >
            <span className="chooser-icon event">
              <FileText size={18} />
            </span>
            <span>
              <strong className="font-display">PDF</strong>
              <small className="font-subtitle">
                {busy === "pdf" ? "កំពុងផ្ញើ…" : "ផ្ញើ PDF ទៅ Telegram រាយខែ"}
              </small>
            </span>
          </button>
          <button
            type="button"
            className="calendar-chooser-item"
            disabled={!items.length || Boolean(busy)}
            onClick={() => run("image")}
          >
            <span className="chooser-icon reminder">
              <ImageIcon size={18} />
            </span>
            <span>
              <strong className="font-display">រូបភាព</strong>
              <small className="font-subtitle">
                {busy === "image" ? "កំពុងផ្ញើ…" : "ផ្ញើរូបភាព ទៅ Telegram រាយខែ"}
              </small>
            </span>
          </button>
        </div>
        {error ? <p className="export-done-error">{error}</p> : null}
      </div>
    </Modal>
  );
}

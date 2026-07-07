/**
 * MüşteriDünyası — düz zeminli, sekmeli, çoklu-çip filtreli.
 * TÜM veri motorları (musteriler/leadler/aramalar/satislar/randevular/cari_hareketler/
 *  wa_konusmalar/wa_mesajlar/kara_liste/kargo-olustur/fn_party_bul_veya_olustur/
 *  cagri_listeleri/liste_kisileri/abonelikler/kayitlar/kayit_alan_tanimlari/varliklar)
 * mevcut panel/koddan birebir aktarıldı; yeni motor icat EDİLMEDİ.
 * Reused: RandevuVerDialog, SiparisGirDialog, MusteriMiniTakvim (MusteriAksiyonlar.tsx).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconSearch,
  IconChevronLeft,
  IconChevronDown,
  IconUsers,
  IconCurrencyLira,
  IconRepeat,
  IconCalendarPlus,
  IconShoppingCartPlus,
  IconPhoneCall,
  IconBrandWhatsapp,
  IconBan,
  IconUserPlus,
  IconCash,
  IconClockEdit,
  IconX,
  IconTruck,
  IconTruckDelivery,
  IconPackage,
  IconArrowBackUp,
  IconLoader2,
  IconPhone,
  IconMessage2,
  IconMessageCircle,
  IconPlaylistAdd,
  IconPlus,
  IconAlertCircle,
  IconCalendar,
  IconCalendarDue,
  IconCalendarRepeat,
  IconPhoneOutgoing,
  IconBox,
  IconPaw,
  IconCar,
  IconDeviceMobile,
  IconHome,
  IconLock,
  IconSend,
  IconFilter,
  IconId,
  IconHistory,
  IconNotes,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFirmaId } from "@/lib/use-firma-id";
import { useSecim } from "@/lib/use-secim";
import { useFirmaYapilandirma } from "@/lib/use-firma-yapilandirma";
import { StatusPill } from "@/components/system/StatusPill";
import { KanalBadge } from "@/components/system/KanalBadge";
import { EmptyState } from "@/components/system/EmptyState";
import { ListSkeleton } from "@/components/system/Skeleton";
import { TopluIslemBar } from "@/components/system/TopluIslemBar";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  RandevuVerDialog,
  SiparisGirDialog,
  MusteriMiniTakvim,
} from "./MusteriAksiyonlar";

/* =============================================================
   Tipler & yardımcılar
   ============================================================= */
type Segment = "hepsi" | "musteri" | "aday";

type MusteriRow = {
  id: string;
  ad_soyad: string | null;
  telefon: string | null;
  il?: string | null;
  ilce?: string | null;
  etiket?: string | null;
  notlar?: string | null;
  geri_arama_tarihi?: string | null;
  olusturuldu_at: string | null;
  email?: string | null;
  adres?: string | null;
  kanal?: string | null;
};
type LeadRow = {
  id: string;
  ad_soyad: string | null;
  telefon: string | null;
  durum: string | null;
  kaynak_etiket: string | null;
  kampanya: string | null;
  kanal: string | null;
  olusturuldu_at: string | null;
};

type Kayit = {
  key: string;
  tip: "musteri" | "aday";
  id: string;
  ad: string;
  telefon: string | null;
  tel10: string;
  altMetin: string;
  sonTemas: string | null;
  olusturuldu_at: string | null;
  il: string | null;
  ilce: string | null;
  notlar: string | null;
  geri_arama_tarihi: string | null;
  karaListede: boolean;
  ham: MusteriRow | LeadRow;
};

function son10(t: string | null | undefined): string {
  return (t ?? "").replace(/\D/g, "").slice(-10);
}
function fmtTL(v: number | null | undefined): string {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);
  } catch { return `${v} ₺`; }
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return String(iso); }
}
function fmtDT(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return String(iso); }
}
function fmtRelKisa(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime(); const now = Date.now();
  const dk = Math.round((now - d) / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa`;
  const gn = Math.round(sa / 24);
  if (gn < 30) return `${gn} gün`;
  return fmtDate(iso);
}
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function bugunISTsinir(): { bas: string; son: string } {
  const now = new Date();
  const ist = new Date(now.getTime() + 3 * 3600 * 1000);
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), d = ist.getUTCDate();
  const bas = new Date(Date.UTC(y, m, d, 0, 0, 0) - 3 * 3600 * 1000).toISOString();
  const son = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - 3 * 3600 * 1000).toISOString();
  return { bas, son };
}

/* =============================================================
   Sabit stiller & küçük bileşenler
   ============================================================= */
const LACI = "#19365F";
const LACI_KOYU = "#2B5288";
const WA = "#1D9E75";
const WA_KOYU = "#0F6E56";
const KIRMIZI = "#A32D2D";
const MAVI = "#185FA5";
const SARI = "#854F0B";

/* Ipucu — overflow'dan etkilenmeyen, fixed konumlu balon */
function Ipucu({ metin }: { metin: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  function ac() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  }
  return (
    <span
      ref={ref}
      onMouseEnter={ac}
      onMouseLeave={() => setPos(null)}
      aria-label="bilgi"
      className="inline-grid place-items-center align-middle"
      style={{
        width: 14, height: 14, borderRadius: 999, marginLeft: 3,
        background: "rgba(25,54,95,0.10)", color: LACI,
        fontSize: 10, fontWeight: 700, lineHeight: 1, cursor: "help", flexShrink: 0,
      }}
    >
      ?
      {pos && (
        <span
          role="tooltip"
          style={{
            position: "fixed", left: pos.x, top: pos.y - 8,
            transform: "translate(-50%, -100%)",
            width: 220, maxWidth: "70vw", background: LACI, color: "#fff",
            padding: "7px 9px", borderRadius: 8, fontSize: 11, lineHeight: 1.4,
            textAlign: "left", zIndex: 9999, pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.22)", whiteSpace: "normal",
          }}
        >{metin}</span>
      )}
    </span>
  );
}

type IkonBtnProps = {
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  busy?: boolean;
  tone?: "default" | "primary" | "danger" | "success";
  children: React.ReactNode;
};
function IkonBtn({ onClick, title, disabled, busy, tone = "default", children }: IkonBtnProps) {
  const stil = (() => {
    if (tone === "primary") return { background: LACI, color: "#fff", border: `1px solid ${LACI}` };
    if (tone === "danger")  return { background: "rgba(163,45,45,0.08)", color: KIRMIZI, border: "1px solid rgba(163,45,45,0.28)" };
    if (tone === "success") return { background: "rgba(29,158,117,0.10)", color: WA_KOYU, border: `1px solid rgba(29,158,117,0.32)` };
    return { background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" };
  })();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      aria-label={title}
      className="grid place-items-center w-8 h-8 shrink-0 transition-colors hover:opacity-90 disabled:opacity-50 active:scale-[.94]"
      style={{ borderRadius: 8, transitionProperty: "opacity,transform,background-color", transitionDuration: "120ms", ...stil }}
    >
      {busy ? <IconLoader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}

/* Beyaz zeminli header aksiyon — 28px */
function BeyazAksiyon({
  title, onClick, disabled, children, wa,
}: { title: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode; wa?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="grid place-items-center shrink-0 hover:brightness-110 disabled:opacity-40 active:scale-[.94] transition-all"
      style={{
        width: 30, height: 30, borderRadius: 8,
        background: wa ? WA : "rgba(255,255,255,0.22)",
        border: wa ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.30)",
        color: "#fff",
        transitionDuration: "120ms",
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number | string; tint: string }) {
  return (
    <div className="bg-card p-2.5" style={{ borderRadius: 10, border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <div className="grid place-items-center shrink-0"
          style={{ width: 26, height: 26, borderRadius: 7, background: `${tint}1A`, color: tint }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-caption uppercase tracking-wide text-muted-foreground truncate">{label}</div>
          <div className="text-[15px] font-semibold text-foreground tabular-nums leading-none mt-0.5" style={{ color: tint }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

/* Mini stat çip — kart üstü */
function MiniStat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="bg-card px-2.5 py-1.5 min-w-0" style={{ borderRadius: 9, border: "1px solid var(--border)" }}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      <div className="text-[13px] font-semibold tabular-nums leading-tight truncate" style={{ color: tint ?? "var(--foreground)" }}>{value}</div>
    </div>
  );
}

function StatTile1a({ ikon, k, v, vc }: { ikon: string; k: string; v: string; vc?: string }) {
  return (
    <div data-card className="flex items-center" style={{ gap: 11, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px" }}>
      <div className="grid place-items-center shrink-0" style={{ width: 40, height: 40, borderRadius: 11, background: "var(--accent-soft)", color: "var(--accent)" }}>
        <span className="msr" style={{ fontSize: 21 }}>{ikon}</span>
      </div>
      <div className="min-w-0">
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--muted)" }}>{k}</div>
        <div className="pjs" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, marginTop: 2, color: vc ?? "var(--ink)" }}>{v}</div>
      </div>
    </div>
  );
}

/* =============================================================
   Çip tanımları
   ============================================================= */
type ChipKey =
  | "borclu" | "satisli" | "randevulu" | "bugun_randevu"
  | "kargolanacak" | "kargoda" | "teslim" | "iadeli" | "iptalli"
  | "aboneli" | "yaklasan_tahsilat"
  | "whatsappli" | "cevap_bekliyor"
  | "geri_aranacak" | "tekrar_aranan"
  | "varligi_olan" | "kara_liste";

type ChipDef = {
  k: ChipKey;
  et: string;
  ipucu: string;
  ikon: React.ReactNode;
  gorunur: (b: BayrakDurumu) => boolean;
};

type BayrakDurumu = {
  satis: boolean; randevu: boolean; cari: boolean; abonelik: boolean; ozne: boolean;
  ozne_tipi: string | null;
};

function ozneIkon(tip: string | null) {
  switch (tip) {
    case "hayvan": return <IconPaw size={11} />;
    case "arac": return <IconCar size={11} />;
    case "cihaz": return <IconDeviceMobile size={11} />;
    case "mulk": return <IconHome size={11} />;
    default: return <IconBox size={11} />;
  }
}

function chipTanimlari(b: BayrakDurumu): ChipDef[] {
  return [
    { k: "borclu",         et: "Borçlu",              ipucu: "Cari bakiyesi borçlu olan kişiler (veresiye toplamı tahsilattan fazla).", ikon: <IconAlertCircle size={11} />,    gorunur: (b) => b.cari },
    { k: "satisli",        et: "Satış yapılmış",       ipucu: "En az bir satış/sipariş kaydı olan kişiler.",                             ikon: <IconCurrencyLira size={11} />,   gorunur: (b) => b.satis },
    { k: "randevulu",      et: "Randevulu",            ipucu: "Gelecekte açık (iptal/tamamlanmamış) randevusu olan kişiler.",           ikon: <IconCalendar size={11} />,        gorunur: (b) => b.randevu },
    { k: "bugun_randevu",  et: "Bugün randevulu",      ipucu: "Randevusu bugüne denk gelen kişiler.",                                    ikon: <IconCalendarDue size={11} />,     gorunur: (b) => b.randevu },
    { k: "kargolanacak",   et: "Kargolanacak",         ipucu: "Siparişi onaylı ama henüz kargoya verilmemiş kişiler.",                   ikon: <IconTruck size={11} />,           gorunur: (b) => b.satis },
    { k: "kargoda",        et: "Kargoda",              ipucu: "Siparişi kargoya verilmiş, henüz teslim edilmemiş kişiler.",              ikon: <IconTruckDelivery size={11} />,   gorunur: (b) => b.satis },
    { k: "teslim",         et: "Teslim edildi",        ipucu: "Siparişi teslim edilmiş kişiler.",                                        ikon: <IconPackage size={11} />,         gorunur: (b) => b.satis },
    { k: "iadeli",         et: "İadeli",               ipucu: "En az bir iade edilmiş siparişi olan kişiler.",                           ikon: <IconArrowBackUp size={11} />,     gorunur: (b) => b.satis },
    { k: "iptalli",        et: "İptalli",              ipucu: "En az bir iptal edilmiş siparişi olan kişiler.",                          ikon: <IconX size={11} />,               gorunur: (b) => b.satis },
    { k: "aboneli",        et: "Aboneli",              ipucu: "Aktif aboneliği olan kişiler.",                                           ikon: <IconRepeat size={11} />,          gorunur: (b) => b.abonelik },
    { k: "yaklasan_tahsilat", et: "Tahsilatı yaklaşan", ipucu: "Aboneliğinin sonraki tahsilatı 7 gün içinde olan kişiler.",              ikon: <IconCalendarRepeat size={11} />,  gorunur: (b) => b.abonelik },
    { k: "whatsappli",     et: "WhatsApp'lı",          ipucu: "WhatsApp üzerinden yazışması olan kişiler.",                              ikon: <IconBrandWhatsapp size={11} />,   gorunur: () => true },
    { k: "cevap_bekliyor", et: "Cevap bekliyor",       ipucu: "Son WhatsApp mesajı okunmamış / yanıt bekleyen kişiler.",                 ikon: <IconMessage2 size={11} />,        gorunur: () => true },
    { k: "geri_aranacak",  et: "Geri aranacak",        ipucu: "Geri arama tarihi belirlenmiş kişiler.",                                  ikon: <IconPhoneOutgoing size={11} />,   gorunur: () => true },
    { k: "tekrar_aranan",  et: "Tekrar aranan",        ipucu: "Birden fazla çağrı kaydı olan kişiler.",                                  ikon: <IconRepeat size={11} />,          gorunur: () => true },
    { k: "varligi_olan",   et: "Varlığı olan",         ipucu: "Kayıtlı hayvan/araç/cihaz/mülkü olan kişiler.",                           ikon: ozneIkon(b.ozne_tipi),             gorunur: (b) => b.ozne },
    { k: "kara_liste",     et: "Kara liste",           ipucu: "Arama yapılmayacak, kara listedeki kişiler.",                             ikon: <IconBan size={11} />,             gorunur: () => true },
  ];
}

function FiltrePopover({
  cipler, aktif, onToggle, onTemizle,
}: {
  cipler: ChipDef[]; aktif: Set<ChipKey>;
  onToggle: (k: ChipKey) => void; onTemizle: () => void;
}) {
  const [acik, setAcik] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acik) return;
    function dis(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false); }
    document.addEventListener("mousedown", dis);
    return () => document.removeEventListener("mousedown", dis);
  }, [acik]);
  const secili = cipler.filter((c) => aktif.has(c.k));
  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button" onClick={() => setAcik((v) => !v)}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium active:scale-[.97] transition-all"
          style={{
            borderRadius: 8,
            background: aktif.size > 0 ? "rgba(25,54,95,0.10)" : "var(--card)",
            color: aktif.size > 0 ? LACI : "var(--foreground)",
            border: `1px solid ${aktif.size > 0 ? LACI : "var(--border)"}`,
            transitionDuration: "120ms",
          }}
        >
          <IconFilter size={13} />
          <span>Filtre</span>
          {aktif.size > 0 && (
            <span className="text-[10px] px-1.5 py-0" style={{ borderRadius: 999, background: LACI, color: "#fff" }}>{aktif.size}</span>
          )}
          <IconChevronDown size={12} style={{ transform: acik ? "rotate(180deg)" : "none", transition: "transform .2s ease" }} />
        </button>
        {secili.map((c) => (
          <span key={c.k} className="inline-flex items-center gap-1 h-6 px-2 text-caption"
            style={{ borderRadius: 999, background: "rgba(25,54,95,0.10)", color: LACI, border: `1px solid ${LACI}` }}>
            {c.ikon}<span>{c.et}</span>
            <button type="button" onClick={() => onToggle(c.k)} className="grid place-items-center" aria-label="kaldır"><IconX size={10} /></button>
          </span>
        ))}
      </div>

      {acik && (
        <div
          className="absolute left-0 mt-1.5 z-50 md-panel-in"
          style={{
            width: 280, maxHeight: 320, overflowY: "auto",
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.16)", padding: 8,
          }}
        >
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-caption font-medium text-muted-foreground uppercase tracking-wide">Filtrele</span>
            {aktif.size > 0 && (
              <button type="button" onClick={onTemizle} className="text-caption" style={{ color: LACI }}>Temizle</button>
            )}
          </div>
          <div className="flex flex-col">
            {cipler.map((c) => {
              const on = aktif.has(c.k);
              return (
                <button key={c.k} type="button" onClick={() => onToggle(c.k)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg hover:bg-[rgba(25,54,95,0.05)] transition-colors">
                  <span className="shrink-0" style={{ width: 16, height: 16, borderRadius: 5, background: on ? LACI : "transparent", border: `1px solid ${on ? LACI : "var(--border)"}` }} />
                  <span className="grid place-items-center shrink-0" style={{ color: LACI }}>{c.ikon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] block truncate">{c.et}</span>
                    <span className="text-[11px] text-muted-foreground block leading-tight">{c.ipucu}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


/* =============================================================
   Ana bileşen
   ============================================================= */
export function MusterilerDunyasi() {
  const { firmaId, missing } = useFirmaId();
  const yap = useFirmaYapilandirma();
  const bayraklar: BayrakDurumu = {
    satis: yap.satis_acik, randevu: yap.randevu_acik, cari: yap.cari_acik,
    abonelik: yap.abonelik_acik, ozne: yap.ozne_acik, ozne_tipi: yap.ozne_tipi,
  };

  const [musteriler, setMusteriler] = useState<MusteriRow[]>([]);
  const [leadler, setLeadler] = useState<LeadRow[]>([]);
  const [karaSet, setKaraSet] = useState<Set<string>>(new Set());
  const [borcSet, setBorcSet] = useState<Set<string>>(new Set());
  const [borcMap, setBorcMap] = useState<Map<string, number>>(new Map());
  const [sonTemasMap, setSonTemasMap] = useState<Map<string, string>>(new Map());
  const [satisTelSet, setSatisTelSet] = useState<Set<string>>(new Set());
  const [aramaSayimTel, setAramaSayimTel] = useState<Map<string, number>>(new Map());
  const [randevuTelSet, setRandevuTelSet] = useState<Set<string>>(new Set()); // gelecek
  const [bugunRvTelSet, setBugunRvTelSet] = useState<Set<string>>(new Set());
  const [yukleniyor, setYukleniyor] = useState(true);

  // Kişinin otomatik durumu için satış/randevu var mı?
  const [randevuVarTel, setRandevuVarTel] = useState<Set<string>>(new Set());

  const [segment, setSegment] = useState<Segment>("hepsi");
  const [arama, setArama] = useState("");
  const [aramaDb, setAramaDb] = useState("");

  const [aktifCipler, setAktifCipler] = useState<Set<ChipKey>>(new Set());
  // Lazy filtre setleri: chipKey -> Set of "m:<id>" or "t:<tel10>"
  const [cipVeri, setCipVeri] = useState<Map<ChipKey, Set<string>>>(new Map());
  const cipVeriRef = useRef(cipVeri);
  useEffect(() => { cipVeriRef.current = cipVeri; }, [cipVeri]);

  const [secili, setSecili] = useState<Kayit | null>(null);
  const [mobilKartAcik, setMobilKartAcik] = useState(false);
  const sec = useSecim();
  const [ekleDialogAcik, setEkleDialogAcik] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAramaDb(arama.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [arama]);

  const yukle = useCallback(async () => {
    if (missing || !firmaId) { setYukleniyor(false); return; }
    setYukleniyor(true);
    const [mRes, lRes, kRes, cRes, aRes, sRes, rRes] = await Promise.all([
      supabase.from("musteriler")
        .select("id, ad_soyad, telefon, il, ilce, etiket, notlar, geri_arama_tarihi, olusturuldu_at, adres, email, kanal")
        .eq("firma_id", firmaId).order("olusturuldu_at", { ascending: false }).limit(1000),
      supabase.from("leadler")
        .select("id, ad_soyad, telefon, durum, kaynak_etiket, kampanya, kanal, olusturuldu_at")
        .eq("firma_id", firmaId).order("olusturuldu_at", { ascending: false }).limit(500),
      supabase.from("kara_liste").select("telefon").eq("firma_id", firmaId),
      supabase.from("cari_hareketler").select("musteri_id, yon, tutar").eq("firma_id", firmaId),
      supabase.from("aramalar").select("musteri_telefon, olusturuldu_at").eq("firma_id", firmaId)
        .order("olusturuldu_at", { ascending: false }).limit(3000),
      supabase.from("satislar").select("musteri_telefon").eq("firma_id", firmaId).limit(5000),
      supabase.from("randevular").select("musteri_telefon, tarih_saat, durum")
        .eq("firma_id", firmaId).limit(3000),
    ]);
    setMusteriler((mRes.data as MusteriRow[] | null) ?? []);
    setLeadler((lRes.data as LeadRow[] | null) ?? []);

    const kara = new Set<string>();
    for (const r of (kRes.data as { telefon: string | null }[] | null) ?? []) {
      const t = son10(r.telefon); if (t) kara.add(t);
    }
    setKaraSet(kara);

    const bak = new Map<string, number>();
    for (const r of (cRes.data as { musteri_id: string | null; yon: string | null; tutar: number | null }[] | null) ?? []) {
      if (!r.musteri_id) continue;
      const t = Number(r.tutar ?? 0);
      bak.set(r.musteri_id, (bak.get(r.musteri_id) ?? 0) + (r.yon === "borc" ? t : -t));
    }
    const bs = new Set<string>();
    for (const [id, b] of bak) if (b > 0) bs.add(id);
    setBorcSet(bs);
    setBorcMap(bak);

    const st = new Map<string, string>();
    const sayi = new Map<string, number>();
    for (const r of (aRes.data as { musteri_telefon: string | null; olusturuldu_at: string | null }[] | null) ?? []) {
      const t = son10(r.musteri_telefon); if (!t) continue;
      if (!st.has(t) && r.olusturuldu_at) st.set(t, r.olusturuldu_at);
      sayi.set(t, (sayi.get(t) ?? 0) + 1);
    }
    setSonTemasMap(st);
    setAramaSayimTel(sayi);

    const sts = new Set<string>();
    for (const r of (sRes.data as { musteri_telefon: string | null }[] | null) ?? []) {
      const t = son10(r.musteri_telefon); if (t) sts.add(t);
    }
    setSatisTelSet(sts);

    const rIleri = new Set<string>();
    const rBugun = new Set<string>();
    const rHer = new Set<string>();
    const { bas, son } = bugunISTsinir();
    const nowMs = Date.now();
    for (const r of (rRes.data as { musteri_telefon: string | null; tarih_saat: string | null; durum: string | null }[] | null) ?? []) {
      const t = son10(r.musteri_telefon); if (!t) continue;
      const k = (r.durum ?? "").toLowerCase();
      if (k === "iptal" || k === "tamamlandi") continue;
      rHer.add(t);
      if (r.tarih_saat && new Date(r.tarih_saat).getTime() > nowMs) rIleri.add(t);
      if (r.tarih_saat && r.tarih_saat >= bas && r.tarih_saat <= son) rBugun.add(t);
    }
    setRandevuTelSet(rIleri);
    setBugunRvTelSet(rBugun);
    setRandevuVarTel(rHer);

    setYukleniyor(false);
    // Çip cache'lerini de sıfırla — veri değişti
    setCipVeri(new Map());
  }, [firmaId, missing]);

  useEffect(() => { void yukle(); }, [yukle]);

  /* --- Lazy çip yükleme --- */
  const yukleCip = useCallback(async (k: ChipKey) => {
    if (!firmaId) return;
    if (cipVeriRef.current.has(k)) return;
    const s = new Set<string>();
    if (k === "borclu") {
      for (const id of borcSet) s.add("m:" + id);
    } else if (k === "kara_liste") {
      for (const t of karaSet) s.add("t:" + t);
    } else if (k === "satisli") {
      for (const t of satisTelSet) s.add("t:" + t);
    } else if (k === "randevulu") {
      for (const t of randevuTelSet) s.add("t:" + t);
    } else if (k === "bugun_randevu") {
      for (const t of bugunRvTelSet) s.add("t:" + t);
    } else if (k === "kargolanacak" || k === "kargoda" || k === "teslim" || k === "iadeli" || k === "iptalli") {
      const durum = k === "kargolanacak" ? "onaylandi" : k === "kargoda" ? "kargolandi" : k === "teslim" ? "teslim_edildi" : k === "iadeli" ? "iade" : "iptal";
      const { data } = await supabase.from("satislar").select("musteri_telefon").eq("firma_id", firmaId).eq("durum", durum).limit(5000);
      for (const r of (data as { musteri_telefon: string | null }[] | null) ?? []) { const t = son10(r.musteri_telefon); if (t) s.add("t:" + t); }
    } else if (k === "aboneli") {
      const { data } = await supabase.from("abonelikler").select("musteri_id").eq("firma_id", firmaId).eq("durum", "aktif").limit(5000);
      for (const r of (data as { musteri_id: string | null }[] | null) ?? []) { if (r.musteri_id) s.add("m:" + r.musteri_id); }
    } else if (k === "yaklasan_tahsilat") {
      const sinir = new Date(); sinir.setDate(sinir.getDate() + 7);
      const sinirStr = sinir.toISOString().slice(0, 10);
      const { data } = await supabase.from("abonelikler").select("musteri_id, sonraki_tahsilat").eq("firma_id", firmaId).eq("durum", "aktif").lte("sonraki_tahsilat", sinirStr).limit(5000);
      for (const r of (data as { musteri_id: string | null; sonraki_tahsilat: string | null }[] | null) ?? []) { if (r.musteri_id) s.add("m:" + r.musteri_id); }
    } else if (k === "whatsappli") {
      const { data } = await supabase.from("wa_konusmalar").select("musteri_telefon").eq("firma_id", firmaId).limit(5000);
      for (const r of (data as { musteri_telefon: string | null }[] | null) ?? []) { const t = son10(r.musteri_telefon); if (t) s.add("t:" + t); }
    } else if (k === "cevap_bekliyor") {
      const { data } = await supabase.from("wa_konusmalar").select("musteri_telefon, okunmadi").eq("firma_id", firmaId).gt("okunmadi", 0).limit(5000);
      for (const r of (data as { musteri_telefon: string | null; okunmadi: number | null }[] | null) ?? []) { const t = son10(r.musteri_telefon); if (t) s.add("t:" + t); }
    } else if (k === "geri_aranacak") {
      const { data } = await supabase.from("musteriler").select("id, geri_arama_tarihi").eq("firma_id", firmaId).not("geri_arama_tarihi", "is", null).limit(5000);
      for (const r of (data as { id: string; geri_arama_tarihi: string | null }[] | null) ?? []) { s.add("m:" + r.id); }
    } else if (k === "tekrar_aranan") {
      for (const [t, n] of aramaSayimTel) if (n > 1) s.add("t:" + t);
    } else if (k === "varligi_olan") {
      const { data } = await supabase.from("varliklar").select("musteri_id").eq("firma_id", firmaId).not("musteri_id", "is", null).limit(5000);
      for (const r of (data as { musteri_id: string | null }[] | null) ?? []) { if (r.musteri_id) s.add("m:" + r.musteri_id); }
    }
    setCipVeri((prev) => { const n = new Map(prev); n.set(k, s); return n; });
  }, [firmaId, borcSet, karaSet, satisTelSet, randevuTelSet, bugunRvTelSet, aramaSayimTel]);

  useEffect(() => {
    for (const k of aktifCipler) void yukleCip(k);
  }, [aktifCipler, yukleCip]);

  function cipToggle(k: ChipKey) {
    setAktifCipler((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  /* --- Birleşik liste + filtre kesişimi --- */
  const liste = useMemo<Kayit[]>(() => {
    const mKayit: Kayit[] = musteriler.map((m) => {
      const t10 = son10(m.telefon);
      return {
        key: "m:" + m.id, tip: "musteri", id: m.id,
        ad: (m.ad_soyad?.trim() || m.telefon || "İsimsiz"),
        telefon: m.telefon, tel10: t10,
        altMetin: m.telefon ?? "",
        sonTemas: sonTemasMap.get(t10) ?? m.olusturuldu_at,
        olusturuldu_at: m.olusturuldu_at,
        il: m.il ?? null, ilce: m.ilce ?? null,
        notlar: m.notlar ?? null, geri_arama_tarihi: m.geri_arama_tarihi ?? null,
        karaListede: t10 ? karaSet.has(t10) : false,
        ham: m,
      };
    });
    const lKayit: Kayit[] = leadler.map((l) => {
      const t10 = son10(l.telefon);
      return {
        key: "l:" + l.id, tip: "aday", id: l.id,
        ad: (l.ad_soyad?.trim() || l.telefon || "Potansiyel"),
        telefon: l.telefon, tel10: t10,
        altMetin: l.telefon ?? "",
        sonTemas: l.olusturuldu_at,
        olusturuldu_at: l.olusturuldu_at,
        il: null, ilce: null, notlar: null, geri_arama_tarihi: null,
        karaListede: t10 ? karaSet.has(t10) : false,
        ham: l,
      };
    });

    let birlesik: Kayit[];
    if (segment === "musteri") birlesik = mKayit;
    else if (segment === "aday") {
      const mSet = new Set(mKayit.map((k) => k.tel10).filter(Boolean));
      birlesik = lKayit.filter((k) => !k.tel10 || !mSet.has(k.tel10));
    } else {
      const mSet = new Set(mKayit.map((k) => k.tel10).filter(Boolean));
      birlesik = [...mKayit, ...lKayit.filter((k) => !k.tel10 || !mSet.has(k.tel10))];
    }

    if (aramaDb) {
      birlesik = birlesik.filter((k) =>
        k.ad.toLowerCase().includes(aramaDb) || (k.telefon ?? "").toLowerCase().includes(aramaDb),
      );
    }

    if (aktifCipler.size > 0) {
      birlesik = birlesik.filter((kayit) => {
        for (const c of aktifCipler) {
          const s = cipVeri.get(c);
          if (!s) return false; // veri yüklenmedi
          const ok = (kayit.tip === "musteri" && s.has("m:" + kayit.id)) || (kayit.tel10 && s.has("t:" + kayit.tel10));
          if (!ok) return false;
        }
        return true;
      });
    }

    birlesik.sort((a, b) => (a.sonTemas ?? "") < (b.sonTemas ?? "") ? 1 : -1);
    return birlesik;
  }, [musteriler, leadler, sonTemasMap, karaSet, segment, aramaDb, aktifCipler, cipVeri]);

  const stats = useMemo(() => ({
    toplam: musteriler.length,
    satisli: satisTelSet.size,
    borclu: borcSet.size,
  }), [musteriler, satisTelSet, borcSet]);

  const tumSecili = liste.length > 0 && liste.every((k) => sec.seciliMi(k.key));
  const seciliKisiler = useMemo(() => liste.filter((k) => sec.seciliMi(k.key)), [liste, sec]);

  async function karaListeToplu() {
    const target = seciliKisiler.filter((k) => k.telefon && !k.karaListede);
    if (target.length === 0) { toast.error("Uygun seçim yok"); return; }
    const rows = target.map((k) => ({ firma_id: firmaId, telefon: k.telefon!, ad_soyad: k.ad, sebep: "Toplu eklendi" }));
    const { error } = await supabase.from("kara_liste").insert(rows);
    if (error) { toast.error("Eklenemedi: " + error.message); return; }
    toast.success(`${rows.length} kişi kara listeye eklendi`);
    sec.temizle(); await yukle();
  }
  function whatsappToplu() {
    if (seciliKisiler.length !== 1) return;
    const tel = son10(seciliKisiler[0].telefon);
    if (!tel) { toast.error("Telefon yok"); return; }
    window.open(`https://wa.me/90${tel}`, "_blank", "noopener,noreferrer");
  }

  function seciminiYap(k: Kayit) { setSecili(k); setMobilKartAcik(true); }

  if (missing) return <div className="p-6 text-center text-sm text-muted-foreground">Firma bağlı değil.</div>;

  const gorunurCipler = chipTanimlari(bayraklar).filter((c) => c.gorunur(bayraklar));

  return (
    <div
      className="w-full h-[100dvh] flex mw1a-root overflow-hidden"
      style={{
        fontFamily: "'Manrope', system-ui, sans-serif",
        background: "#f4f6fa",
        // 1a LACİVERT palet (yeşilin birebir karşılığı) + uygulama token override
        ["--bg" as string]: "#f4f6fa",
        ["--surface" as string]: "#ffffff",
        ["--ink" as string]: "#0f1b2e",
        ["--muted" as string]: "#66708a",
        ["--line" as string]: "#e6eaf1",
        ["--rail" as string]: "#142a4a",
        ["--rail-fg" as string]: "#a9b8d6",
        ["--accent" as string]: "#19365F",
        ["--accent-soft" as string]: "#e7ecf5",
        ["--header" as string]: "#19365F",
        ["--header-fg" as string]: "#eaf0fb",
        ["--good" as string]: "#15803d",
        ["--bad" as string]: "#dc2626",
        // uygulama tokenlarını da 1a nötr-lacivert'e sabitle (sekme gövdeleri uyumlansın)
        ["--background" as string]: "#f4f6fa",
        ["--card" as string]: "#ffffff",
        ["--border" as string]: "#e6eaf1",
        ["--foreground" as string]: "#0f1b2e",
        ["--muted-foreground" as string]: "#66708a",
        ["--secondary" as string]: "#eef1f7",
      } as React.CSSProperties}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0,0&display=swap');
        .mw1a-root .msr{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;line-height:1;display:inline-flex;align-items:center;justify-content:center;user-select:none;}
        .mw1a-root .pjs{font-family:'Plus Jakarta Sans',sans-serif;}
        .ipucu-wrap:hover .ipucu-balon { opacity: 1; }
        .md-panel-in { animation: mdPanelIn .28s ease both; }
        @keyframes mdPanelIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes aIn { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }
        @keyframes aRow { from { opacity:0; transform:translateY(-10px);} to { opacity:1; transform:translateY(0);} }
        .mw1a-root [data-card]{opacity:0;animation:aIn .5s ease forwards;}
        .mw1a-root .md-panel-in .bg-card{animation:aIn .42s cubic-bezier(.22,.7,.2,1) both;}
        .mw1a-root .md-panel-in .bg-card:nth-of-type(2){animation-delay:.05s;}
        .mw1a-root .md-panel-in .bg-card:nth-of-type(3){animation-delay:.1s;}
        .mw1a-root [data-tl]{opacity:0;animation:aRow .45s ease forwards;}
        .mw1a-rail a{transition:background .16s ease, transform .16s ease, color .16s ease;}
        .mw1a-rail a:hover{background:rgba(255,255,255,.08);transform:translateY(-2px);color:#fff;}
        .mw1a-lr{transition:background .14s ease, transform .14s ease, border-color .14s ease;border:1px solid transparent;}
        .mw1a-lr:hover{background:var(--accent-soft);transform:translateX(3px);}
        .mw1a-lr.sel{background:var(--accent-soft);border-color:var(--accent);}
      `}</style>

      {/* ================= SOL LİSTE (1a) ================= */}
      <aside
        className={`${mobilKartAcik ? "hidden lg:flex" : "flex"} flex-col shrink-0 w-full lg:w-[330px] lg:max-w-[330px] lg:my-2.5 lg:ml-2.5`}
        style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, boxShadow: "0 1px 2px rgba(15,27,46,.04), 0 10px 26px rgba(15,27,46,.06)", minHeight: 0, overflow: "hidden" }}
      >
        <div className="shrink-0 flex flex-col">
          <div className="flex items-center" style={{ gap: 9, padding: "16px 18px 10px" }}>
            <span className="msr" style={{ fontSize: 23, color: "var(--accent)" }}>groups</span>
            <span className="pjs" style={{ fontSize: 18, fontWeight: 800 }}>Müşterilerim</span>
          </div>

          {/* 3 stat (1a) */}
          <div className="grid grid-cols-3" style={{ gap: 8, padding: "0 18px 12px" }}>
            {([
              { n: stats.toplam, k: "Toplam", c: "var(--ink)" },
              { n: stats.satisli, k: "Satışlı", c: "var(--good)" },
              { n: stats.borclu, k: "Borçlu", c: "var(--bad)" },
            ] as { n: number; k: string; c: string }[]).map((s) => (
              <div key={s.k} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "9px 10px" }}>
                <div className="pjs" style={{ fontSize: 19, fontWeight: 800, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)" }}>{s.k}</div>
              </div>
            ))}
          </div>

          {/* arama (1a) */}
          <div style={{ padding: "0 18px 10px" }}>
            <div className="flex items-center" style={{ gap: 9, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 11, padding: "8px 12px" }}>
              <span className="msr" style={{ fontSize: 19, color: "var(--muted)" }}>search</span>
              <input
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="İsim veya telefon…"
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: 13, color: "var(--ink)" }}
              />
            </div>
          </div>

          {/* segment (1a) */}
          <div style={{ padding: "0 18px 10px" }}>
            <div className="flex" style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 11, padding: 3, gap: 3 }}>
              {(["hepsi", "musteri", "aday"] as Segment[]).map((s) => {
                const aktif = segment === s;
                const et = s === "hepsi" ? "Hepsi" : s === "musteri" ? "Müşteriler" : "Potansiyeller";
                return (
                  <button key={s} type="button" onClick={() => setSegment(s)}
                    className="flex-1 text-center active:scale-[.98] transition-transform"
                    style={{ padding: 7, borderRadius: 9, fontSize: 12.5, fontWeight: aktif ? 700 : 600,
                      background: aktif ? "var(--accent)" : "transparent", color: aktif ? "#fff" : "var(--muted)" }}>
                    {et}
                  </button>
                );
              })}
            </div>
          </div>

          {/* filtre — açılır popover (motor korunur) */}
          <div style={{ padding: "0 18px 10px" }}>
            <FiltrePopover
              cipler={gorunurCipler}
              aktif={aktifCipler}
              onToggle={cipToggle}
              onTemizle={() => setAktifCipler(new Set())}
            />
          </div>

          {/* tümünü seç (1a) */}
          <div className="flex items-center" style={{ gap: 10, padding: "0 18px 8px" }}>
            <input type="checkbox" checked={tumSecili}
              onChange={() => tumSecili ? sec.temizle() : sec.tumunuSec(liste.map((k) => k.key))}
              style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>Tümünü seç</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>· {liste.length} kayıt</span>
            <div style={{ flex: 1 }} />
            <span className="flex items-center" style={{ gap: 4, fontSize: 11.5, color: "var(--muted)" }}>
              <span className="msr" style={{ fontSize: 15 }}>swap_vert</span>Son temas
            </span>
          </div>
        </div>

        {/* satırlar (1a) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {yukleniyor ? (
            <div className="p-3"><ListSkeleton rows={8} /></div>
          ) : liste.length === 0 ? (
            <div className="p-3">
              <EmptyState icon={<IconUsers size={18} />} title="Kayıt yok" hint="Arama veya çipleri değiştirin." />
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: 8, padding: "6px 12px 12px" }}>
              {liste.map((k) => {
                const aktif = secili?.key === k.key;
                const secili2 = sec.seciliMi(k.key);
                const durumRz = otoDurumRozet(k, borcMap, randevuVarTel, satisTelSet);
                return (
                  <div key={k.key}
                    className="flex items-center cursor-pointer"
                    style={{ gap: 11, padding: "11px 13px", borderRadius: 14,
                      border: `1px solid ${aktif ? "var(--accent)" : "var(--line)"}`,
                      background: aktif ? "linear-gradient(180deg,#ffffff,#f7f9fd)" : "#fff",
                      boxShadow: aktif ? "0 3px 8px rgba(25,54,95,.12), 0 12px 26px rgba(25,54,95,.14)" : "0 1px 2px rgba(15,27,46,.03), 0 4px 12px rgba(15,27,46,.05)",
                      transition: "transform .16s ease, box-shadow .16s ease, border-color .16s ease" }}
                    onMouseEnter={(e) => { if (!aktif) { const t = e.currentTarget as HTMLDivElement; t.style.transform = "translateY(-2px)"; t.style.boxShadow = "0 3px 8px rgba(15,27,46,.06), 0 10px 22px rgba(15,27,46,.09)"; } }}
                    onMouseLeave={(e) => { if (!aktif) { const t = e.currentTarget as HTMLDivElement; t.style.transform = "none"; t.style.boxShadow = "0 1px 2px rgba(15,27,46,.03), 0 4px 12px rgba(15,27,46,.05)"; } }}
                    onClick={() => seciminiYap(k)}
                  >
                    <input type="checkbox" checked={secili2}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => sec.degistir(k.key)}
                      style={{ accentColor: "var(--accent)", width: 17, height: 17 }}
                      className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between" style={{ gap: 6 }}>
                        <span className="truncate" style={{ fontSize: 14, fontWeight: 700, color: aktif ? "var(--accent)" : "var(--ink)" }}>{k.ad}</span>
                        <span className="shrink-0" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: durumRz.bg, color: durumRz.fg }}>{durumRz.et}</span>
                      </div>
                      <div className="flex items-center justify-between" style={{ gap: 6, marginTop: 3 }}>
                        <span className="truncate tabular-nums" style={{ fontSize: 12.5, color: "var(--muted)" }}>{k.telefon || (k.tip === "aday" ? "Potansiyel" : "—")}</span>
                        <span className="shrink-0 tabular-nums" style={{ fontSize: 11, color: "var(--muted)" }}>{fmtRelKisa(k.sonTemas)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </aside>

      {/* ================= SAĞ DETAY ================= */}
      <section className={`${mobilKartAcik ? "flex" : "hidden lg:flex"} flex-1 min-w-0 flex-col min-h-0`} style={{ background: "var(--bg)" }}>
        {secili ? (
          <KartDetay
            key={secili.key}
            secili={secili}
            firmaId={firmaId}
            bayraklar={bayraklar}
            onGeri={() => setMobilKartAcik(false)}
            onDataDegisti={yukle}
          />
        ) : (
          <div className="flex-1 grid place-items-center p-8">
            <EmptyState icon={<IconUsers size={20} />} title="Soldan bir kişi seç" hint="Kart burada görünecek." />
          </div>
        )}
      </section>

      {/* ================= TOPLU İŞLEM BAR ================= */}
      <TopluIslemBar
        sayi={seciliKisiler.length}
        onTemizle={sec.temizle}
        eylemler={[
          {
            etiket: "Arama listesine ekle", ikon: <IconPlaylistAdd size={14} />,
            onClick: () => setEkleDialogAcik(true),
            disabled: seciliKisiler.filter((k) => !!k.telefon).length === 0,
          },
          {
            etiket: "WhatsApp'a gönder", ikon: <IconBrandWhatsapp size={14} />,
            onClick: whatsappToplu,
            disabled: seciliKisiler.length !== 1 || !seciliKisiler[0]?.telefon,
          },
          {
            etiket: "Kara listeye ekle", ikon: <IconBan size={14} />,
            onClick: () => void karaListeToplu(),
            tehlike: true,
            disabled: seciliKisiler.filter((k) => k.telefon && !k.karaListede).length === 0,
          },
        ]}
      />

      <AramaListeyeEkleDialog
        acik={ekleDialogAcik}
        onClose={() => setEkleDialogAcik(false)}
        firmaId={firmaId}
        kisiler={seciliKisiler}
        onTamam={() => { setEkleDialogAcik(false); sec.temizle(); void yukle(); }}
      />
    </div>
  );
}

/* Otomatik durum rozeti (liste satırı) */
function otoDurumRozet(k: Kayit, borcMap: Map<string, number>, randevuVarTel: Set<string>, satisTelSet: Set<string>): { et: string; bg: string; fg: string } {
  if (k.karaListede) return { et: "Kara liste", bg: "rgba(163,45,45,0.10)", fg: KIRMIZI };
  const borc = k.tip === "musteri" ? (borcMap.get(k.id) ?? 0) : 0;
  if (borc > 0) return { et: `Borç ${fmtTL(borc)}`, bg: "rgba(163,45,45,0.10)", fg: KIRMIZI };
  if (k.tel10 && randevuVarTel.has(k.tel10)) return { et: "Randevulu", bg: "rgba(24,95,165,0.10)", fg: MAVI };
  if (k.tel10 && satisTelSet.has(k.tel10)) return { et: "Satışlı", bg: "rgba(29,158,117,0.12)", fg: WA_KOYU };
  if (k.tip === "aday") return { et: "Yeni", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  return { et: "Görüşüldü", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
}

/* =============================================================
   Sağ kart — detay (SEKMELİ)
   ============================================================= */

type Randevu = { id: string; tarih_saat: string | null; durum: string | null; hizmet_id: string | null; sure_dakika: number | null };
type Satis = { id: string; olusturuldu_at: string | null; durum: string | null; tutar: number | null; urun_id: string | null; adet?: number | null; adres?: string | null; il?: string | null; ilce?: string | null };
type Cari = { id: string; yon: string | null; tutar: number | null; tarih: string | null; aciklama: string | null };
type CagriDetay = {
  id: string; olusturuldu_at: string | null; sure_saniye: number | null;
  satis_durumu: string | null; cinsiyet: string | null; yas: number | null;
  il: string | null; ilce: string | null; urun_adi: string | null;
  satis_fiyati: number | null; itiraz_turu: string | null;
  ses_kaydi_url: string | null; transkript: string | null; ozet: string | null;
  adres: string | null; maliyet_usd: number | null;
};
type WaKonusma = { id: string; son_mesaj_at: string | null; okunmadi: number | null };
type WaMesaj = { id: string; yon: string | null; icerik: string | null; olusturuldu_at: string | null };
type Abonelik = { id: string; ad: string | null; tutar: number | null; periyot: string | null; baslangic: string | null; sonraki_tahsilat: string | null; durum: string | null; notlar: string | null };
type AlanTanim = { alan_adi: string; etiket: string; veri_tipi: string; gizli: boolean; sira: number | null; tip: string };
type KayitRow = { id: string; baslik: string | null; tip: string | null; alanlar: Record<string, unknown> | null; olusturuldu_at: string | null };
type Varlik = { id: string; ad: string | null; tip: string | null; ozellikler: Record<string, unknown> | null; notlar: string | null };

type SekmeK = "ozet" | "cagrilar" | "wa" | "satis" | "randevu" | "cari" | "abonelik" | "kayitlar" | "varliklar";

function KartDetay({
  secili, firmaId, bayraklar, onGeri, onDataDegisti,
}: {
  secili: Kayit; firmaId: string; bayraklar: BayrakDurumu;
  onGeri: () => void; onDataDegisti: () => void | Promise<void>;
}) {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [borc, setBorc] = useState(0);
  const [aramaSayisi, setAramaSayisi] = useState(0);
  const [satisTutar, setSatisTutar] = useState(0);
  const [kayitTarihi, setKayitTarihi] = useState<string | null>(null);
  const [randevular, setRandevular] = useState<Randevu[]>([]);
  const [satislar, setSatislar] = useState<Satis[]>([]);
  const [cari, setCari] = useState<Cari[]>([]);
  const [aramalar, setAramalar] = useState<CagriDetay[]>([]);
  const [konusmalar, setKonusmalar] = useState<WaKonusma[]>([]);
  const [hizmetMap, setHizmetMap] = useState<Map<string, string>>(new Map());
  const [urunMap, setUrunMap] = useState<Map<string, string>>(new Map());
  const [sonAdres, setSonAdres] = useState<{ adres: string | null; il: string | null; ilce: string | null } | null>(null);
  const [takvimYenile, setTakvimYenile] = useState(0);
  const isteRef = useRef(0);

  // Sekme
  const [sekme, setSekme] = useState<SekmeK>("ozet");
  useEffect(() => {
    // Görünmez sekmeye düşme koruması
    const gor = sekmeGorunur(sekme, bayraklar);
    if (!gor) setSekme("ozet");
  }, [sekme, bayraklar]);

  // Ek: WA mesajları, abonelikler, kayitlar+alanlar, varliklar
  const [waMesajlar, setWaMesajlar] = useState<WaMesaj[]>([]);
  const [waYanit, setWaYanit] = useState("");
  const [waGonder, setWaGonder] = useState(false);
  const [abonelikler, setAbonelikler] = useState<Abonelik[]>([]);
  const [kAlanlar, setKAlanlar] = useState<AlanTanim[]>([]);
  const [kKayitlar, setKKayitlar] = useState<KayitRow[]>([]);
  const [varliklar, setVarliklar] = useState<Varlik[]>([]);

  // Sekme sayacı
  const sekmeSayilari = {
    cagrilar: aramalar.length,
    wa: waMesajlar.length,
    satis: satislar.length,
    randevu: randevular.length,
    cari: cari.length,
    abonelik: abonelikler.length,
    kayitlar: kKayitlar.length,
    varliklar: varliklar.length,
  };

  // Cagri detay için genişleme
  const [acikCagri, setAcikCagri] = useState<string | null>(null);

  // Not & geri arama
  const [notlar, setNotlar] = useState(secili.notlar ?? "");
  const [geri, setGeri] = useState(toLocalInput(secili.geri_arama_tarihi));
  const [notBusy, setNotBusy] = useState(false);
  useEffect(() => { setNotlar(secili.notlar ?? ""); setGeri(toLocalInput(secili.geri_arama_tarihi)); }, [secili]);

  // Dialoglar
  const [randevuAcik, setRandevuAcik] = useState(false);
  const [randevuBaslangicISO, setRandevuBaslangicISO] = useState<string>("");
  const [siparisAcik, setSiparisAcik] = useState(false);
  const [arzuOnay, setArzuOnay] = useState(false);
  const [karaOnay, setKaraOnay] = useState(false);
  const [satisOnay, setSatisOnay] = useState<{ r: Satis; islem: "kargola" | "iade" | "iptal" } | null>(null);
  const [randevuIptalOnay, setRandevuIptalOnay] = useState<Randevu | null>(null);
  const [randevuSaat, setRandevuSaat] = useState<{ r: Randevu; deger: string } | null>(null);
  const [tahsilAcik, setTahsilAcik] = useState(false);
  const [tahsilForm, setTahsilForm] = useState({ tutar: "", aciklama: "" });
  const [aksiyonBusy, setAksiyonBusy] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!firmaId) return;
    const no = ++isteRef.current;
    setYukleniyor(true);
    const tel = secili.tel10;
    const musteriId = secili.tip === "musteri" ? secili.id : null;

    const randevuQ = supabase.from("randevular")
      .select("id, tarih_saat, durum, hizmet_id, sure_dakika, musteri_telefon")
      .eq("firma_id", firmaId).order("tarih_saat", { ascending: false }).limit(100);
    const satisQ = supabase.from("satislar")
      .select("id, olusturuldu_at, durum, tutar, urun_id, adet, musteri_telefon, adres, il, ilce")
      .eq("firma_id", firmaId).order("olusturuldu_at", { ascending: false }).limit(100);
    const aramaQ = supabase.from("aramalar")
      .select("id, olusturuldu_at, sure_saniye, satis_durumu, cinsiyet, yas, il, ilce, urun_adi, satis_fiyati, itiraz_turu, ses_kaydi_url, transkript, ozet, adres, maliyet_usd, musteri_telefon")
      .eq("firma_id", firmaId).order("olusturuldu_at", { ascending: false }).limit(50);
    const konusmaQ = supabase.from("wa_konusmalar")
      .select("id, son_mesaj_at, okunmadi, musteri_telefon")
      .eq("firma_id", firmaId).order("son_mesaj_at", { ascending: false }).limit(50);
    const cariQ = musteriId
      ? supabase.from("cari_hareketler").select("id, yon, tutar, tarih, aciklama")
          .eq("firma_id", firmaId).eq("musteri_id", musteriId).order("tarih", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as unknown[], error: null });
    const musteriQ = musteriId
      ? supabase.from("musteriler").select("olusturuldu_at").eq("id", musteriId).maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const abonelikQ = musteriId
      ? supabase.from("abonelikler")
          .select("id, ad, tutar, periyot, baslangic, sonraki_tahsilat, durum, notlar")
          .eq("firma_id", firmaId).eq("musteri_id", musteriId).order("olusturuldu_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[], error: null });
    const alanQ = supabase.from("kayit_alan_tanimlari")
      .select("alan_adi, etiket, veri_tipi, gizli, sira, tip")
      .eq("firma_id", firmaId).order("sira", { ascending: true });
    const kayitQ = musteriId
      ? supabase.from("kayitlar")
          .select("id, baslik, tip, alanlar, olusturuldu_at")
          .eq("firma_id", firmaId).eq("musteri_id", musteriId).order("olusturuldu_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[], error: null });
    const varlikQ = musteriId
      ? supabase.from("varliklar")
          .select("id, ad, tip, ozellikler, notlar")
          .eq("firma_id", firmaId).eq("musteri_id", musteriId).order("olusturuldu_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[], error: null });

    const [rR, sR, cR, aR, kR, mR, abR, alR, kyR, vR] = await Promise.all([
      randevuQ, satisQ, cariQ, aramaQ, konusmaQ, musteriQ, abonelikQ, alanQ, kayitQ, varlikQ,
    ]);
    if (no !== isteRef.current) return;

    const rTum = (rR.data as (Randevu & { musteri_telefon: string | null })[] | null) ?? [];
    const rFilt = tel ? rTum.filter((r) => son10(r.musteri_telefon) === tel) : [];
    const sTum = (sR.data as (Satis & { musteri_telefon: string | null })[] | null) ?? [];
    const sFilt = tel ? sTum.filter((r) => son10(r.musteri_telefon) === tel) : [];
    const aTum = (aR.data as (CagriDetay & { musteri_telefon: string | null })[] | null) ?? [];
    const aFilt = tel ? aTum.filter((r) => son10(r.musteri_telefon) === tel) : [];
    const kTum = (kR.data as (WaKonusma & { musteri_telefon: string | null })[] | null) ?? [];
    const kFilt = tel ? kTum.filter((r) => son10(r.musteri_telefon) === tel) : [];

    setRandevular(rFilt);
    setSatislar(sFilt);
    setAramalar(aFilt);
    setKonusmalar(kFilt);
    setAramaSayisi(aFilt.length);
    setSatisTutar(sFilt.reduce((s, r) => s + Number(r.tutar ?? 0), 0));

    const sonSip = sFilt.find((s) => s.adres ?? s.il ?? s.ilce);
    setSonAdres(sonSip ? { adres: sonSip.adres ?? null, il: sonSip.il ?? null, ilce: sonSip.ilce ?? null } : null);

    const cariList = (cR.data as Cari[] | null) ?? [];
    setCari(cariList);
    let bakiye = 0;
    for (const r of cariList) bakiye += r.yon === "borc" ? Number(r.tutar ?? 0) : -Number(r.tutar ?? 0);
    setBorc(bakiye);

    const mrow = (mR.data as { olusturuldu_at: string | null } | null) ?? null;
    setKayitTarihi(mrow?.olusturuldu_at ?? secili.olusturuldu_at ?? null);

    setAbonelikler((abR.data as Abonelik[] | null) ?? []);
    setKAlanlar((alR.data as AlanTanim[] | null) ?? []);
    setKKayitlar((kyR.data as KayitRow[] | null) ?? []);
    setVarliklar((vR.data as Varlik[] | null) ?? []);

    const hIds = Array.from(new Set(rFilt.map((r) => r.hizmet_id).filter((x): x is string => !!x)));
    const uIds = Array.from(new Set(sFilt.map((r) => r.urun_id).filter((x): x is string => !!x)));
    const [hR, uR] = await Promise.all([
      hIds.length ? supabase.from("hizmetler").select("id, hizmet_adi").in("id", hIds) : Promise.resolve({ data: [], error: null }),
      uIds.length ? supabase.from("urunler").select("id, ad").in("id", uIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (no !== isteRef.current) return;
    const hm = new Map<string, string>();
    for (const h of (hR.data as { id: string; hizmet_adi: string | null }[] | null) ?? []) hm.set(h.id, h.hizmet_adi ?? "—");
    setHizmetMap(hm);
    const um = new Map<string, string>();
    for (const u of (uR.data as { id: string; ad: string | null }[] | null) ?? []) um.set(u.id, u.ad ?? "—");
    setUrunMap(um);

    setYukleniyor(false);
    setTakvimYenile((v) => v + 1);
  }, [firmaId, secili]);

  useEffect(() => { void yukle(); }, [yukle]);

  // WA sekmesi açıldığında mesajları yükle
  const yukleMesajlar = useCallback(async () => {
    const k = konusmalar[0];
    if (!k) { setWaMesajlar([]); return; }
    const { data } = await supabase.from("wa_mesajlar")
      .select("id, yon, icerik, olusturuldu_at")
      .eq("konusma_id", k.id)
      .order("olusturuldu_at", { ascending: true })
      .limit(500);
    setWaMesajlar((data as WaMesaj[] | null) ?? []);
  }, [konusmalar]);
  useEffect(() => {
    if (sekme === "wa") void yukleMesajlar();
  }, [sekme, yukleMesajlar]);

  async function waMesajGonder() {
    const k = konusmalar[0];
    if (!k || !waYanit.trim()) return;
    setWaGonder(true);
    const { error } = await supabase.functions.invoke("wa-send", {
      body: { konusma_id: k.id, mesaj: waYanit.trim() },
    });
    setWaGonder(false);
    if (error) { toast.error("Gönderilemedi: " + error.message); return; }
    setWaYanit("");
    await yukleMesajlar();
  }

  async function tumYenile() { await yukle(); await onDataDegisti(); }

  async function notKaydet() {
    if (secili.tip !== "musteri") { toast.error("Aday için not kaydedilemez"); return; }
    if (!secili.telefon) { toast.error("Telefon yok"); return; }
    setNotBusy(true);
    const geriIso = geri ? new Date(geri).toISOString() : null;
    const { error } = await supabase.from("musteriler").upsert({
      firma_id: firmaId, telefon: secili.telefon, ad_soyad: secili.ad,
      notlar: notlar.trim() || null, geri_arama_tarihi: geriIso,
      guncellendi_at: new Date().toISOString(),
    }, { onConflict: "firma_id,telefon" });
    setNotBusy(false);
    if (error) { toast.error("Kaydedilemedi: " + error.message); return; }
    toast.success("Not kaydedildi");
    await onDataDegisti();
  }

  async function karaListeEkle() {
    if (!secili.telefon) { toast.error("Telefon yok"); return; }
    const sebep = typeof window !== "undefined"
      ? window.prompt(`${secili.ad} kara listeye eklenecek. Sebep (opsiyonel):`, "Manuel eklendi")
      : "Manuel eklendi";
    if (sebep === null) return;
    const { error } = await supabase.from("kara_liste").insert({
      firma_id: firmaId, telefon: secili.telefon, ad_soyad: secili.ad,
      sebep: sebep.trim() || "Manuel eklendi",
    });
    if (error) { toast.error("Eklenemedi: " + error.message); return; }
    toast.success("Kara listeye eklendi");
    await onDataDegisti();
  }

  async function arzuArasin() {
    setArzuOnay(false);
    const tel = (secili.telefon ?? "").replace(/\s+/g, "");
    if (tel.length < 7) { toast.error("Geçerli numara yok"); return; }
    const { error } = await supabase.from("aramalar").insert({
      firma_id: firmaId, musteri_telefon: tel, musteri_adi: secili.ad || null,
      durum: "aranıyor", satis_durumu: null,
    });
    if (error) { toast.error("Başlatılamadı: " + error.message); return; }
    toast.success("Arama başlatıldı");
    await tumYenile();
  }

  function whatsappAc() {
    const t = son10(secili.telefon);
    if (!t) { toast.error("Telefon yok"); return; }
    window.open(`https://wa.me/90${t}`, "_blank", "noopener,noreferrer");
  }

  async function kargola(r: Satis) {
    setAksiyonBusy("kargola:" + r.id);
    try {
      const { data, error } = await supabase.functions.invoke("kargo-olustur", { body: { satis_id: r.id } });
      if (error) { toast.error("Kargo oluşturulamadı: " + (error.message ?? "")); return; }
      const res = (data ?? {}) as { takip_no?: string; kargo_firmasi?: string };
      toast.success(`Kargo: ${res.kargo_firmasi ?? ""} ${res.takip_no ?? ""}`.trim());
      await tumYenile();
    } finally { setAksiyonBusy(null); }
  }
  async function satisDurumGuncelle(r: Satis, yeni: "iade" | "iptal") {
    setAksiyonBusy(yeni + ":" + r.id);
    try {
      const { error } = await supabase.from("satislar").update({ durum: yeni }).eq("id", r.id);
      if (error) { toast.error("Güncellenemedi: " + error.message); return; }
      toast.success(yeni === "iade" ? "İade alındı" : "İptal edildi");
      await tumYenile();
    } finally { setAksiyonBusy(null); }
  }
  async function satisOnayUygula() {
    if (!satisOnay) return;
    const { r, islem } = satisOnay; setSatisOnay(null);
    if (islem === "kargola") await kargola(r);
    else await satisDurumGuncelle(r, islem);
  }

  async function randevuIptalUygula() {
    if (!randevuIptalOnay) return;
    const r = randevuIptalOnay; setRandevuIptalOnay(null);
    setAksiyonBusy("rvIptal:" + r.id);
    try {
      const { error } = await supabase.from("randevular").update({ durum: "iptal" }).eq("id", r.id);
      if (error) { toast.error("İptal edilemedi: " + error.message); return; }
      toast.success("Randevu iptal edildi");
      await tumYenile();
    } finally { setAksiyonBusy(null); }
  }
  async function randevuSaatUygula() {
    if (!randevuSaat) return;
    const { r, deger } = randevuSaat;
    if (!deger) { toast.error("Tarih seçin"); return; }
    setAksiyonBusy("rvSaat:" + r.id);
    try {
      const { error } = await supabase.from("randevular").update({ tarih_saat: new Date(deger).toISOString() }).eq("id", r.id);
      if (error) { toast.error("Güncellenemedi: " + error.message); return; }
      toast.success("Saat güncellendi"); setRandevuSaat(null);
      await tumYenile();
    } finally { setAksiyonBusy(null); }
  }

  function tahsilAc() { setTahsilForm({ tutar: borc > 0 ? String(borc) : "", aciklama: "" }); setTahsilAcik(true); }
  async function tahsilKaydet() {
    if (secili.tip !== "musteri") return;
    const tutarNum = Number(tahsilForm.tutar);
    if (!Number.isFinite(tutarNum) || tutarNum <= 0) { toast.error("Tutar 0'dan büyük olmalı"); return; }
    setAksiyonBusy("tahsil");
    try {
      const { error } = await supabase.from("cari_hareketler").insert({
        firma_id: firmaId, musteri_id: secili.id,
        yon: "tahsilat", tutar: tutarNum,
        aciklama: tahsilForm.aciklama.trim() || null,
        tarih: new Date().toISOString().slice(0, 10),
      });
      if (error) { toast.error("Kaydedilemedi: " + error.message); return; }
      toast.success("Tahsilat eklendi"); setTahsilAcik(false);
      await tumYenile();
    } finally { setAksiyonBusy(null); }
  }

  async function abonelikDurumu(id: string, yeni: "aktif" | "duraklatildi" | "iptal") {
    const { error } = await supabase.from("abonelikler").update({ durum: yeni }).eq("id", id);
    if (error) { toast.error("Güncellenemedi: " + error.message); return; }
    toast.success("Durum güncellendi");
    await yukle();
  }

  const [musteriYapBusy, setMusteriYapBusy] = useState(false);
  async function adayiMusteriYap() {
    if (!secili.telefon) { toast.error("Telefon yok"); return; }
    setMusteriYapBusy(true);
    try {
      const { error } = await supabase.from("musteriler").upsert({
        firma_id: firmaId, telefon: secili.telefon,
        ad_soyad: secili.ad || null,
        guncellendi_at: new Date().toISOString(),
      }, { onConflict: "firma_id,telefon" });
      if (error) { toast.error("Oluşturulamadı: " + error.message); return; }
      toast.success("Müşteri kaydı oluşturuldu");
      await onDataDegisti();
    } finally { setMusteriYapBusy(false); }
  }

  /* ================== ADAY KARTI ================== */
  if (secili.tip === "aday") {
    const l = secili.ham as LeadRow;
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <MobilGeri onGeri={onGeri} />
        <div className="p-3 flex flex-col gap-2.5">
          <div className="p-3 flex items-center gap-2" style={{ background: LACI, borderRadius: 10 }}>
            <div className="grid place-items-center shrink-0" style={{ width: 34, height: 34, borderRadius: 7, background: "rgba(255,255,255,0.15)", color: "#fff" }}>
              <span className="text-sm font-semibold">{basHarf(secili.ad)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[16px] font-medium truncate text-white">{secili.ad}</span>
                <span className="text-[10px] px-1.5 py-0" style={{ borderRadius: 4, background: "rgba(255,255,255,0.16)", color: "#fff" }}>Potansiyel</span>
                {l.kanal && <KanalBadge kanal={l.kanal} />}
              </div>
              <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.72)" }}>{secili.telefon ?? "Telefon yok"}</div>
            </div>
            <button
              type="button" onClick={() => void adayiMusteriYap()}
              disabled={musteriYapBusy || !secili.telefon}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium disabled:opacity-60"
              style={{ borderRadius: 8, background: "#fff", color: LACI }}
            >
              {musteriYapBusy ? <IconLoader2 size={14} className="animate-spin" /> : <IconUserPlus size={14} />}
              Müşteri yap
            </button>
          </div>

          <div className="bg-card p-3" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <BilgiSatir et="Telefon" v={secili.telefon ?? "—"} />
              <BilgiSatir et="Durum" v={l.durum ?? "—"} />
              <BilgiSatir et="Kaynak" v={l.kaynak_etiket ?? "—"} />
              <BilgiSatir et="Kampanya" v={l.kampanya ?? "—"} />
              <BilgiSatir et="Kanal" v={l.kanal ?? "—"} />
              <BilgiSatir et="Kayıt" v={fmtDate(l.olusturuldu_at)} />
            </dl>
          </div>

          <div className="text-caption text-muted-foreground italic">Henüz müşteri kaydı yok — "Müşteri yap" ile geçmiş ve işlemler açılır.</div>
        </div>
      </div>
    );
  }

  /* ================== MÜŞTERİ KARTI ================== */
  const sekmeler: { k: SekmeK; et: string; ipucu: string; sayi?: number; gor: boolean }[] = [
    { k: "ozet",       et: "Özet",         ipucu: "Kişinin kimliği, notları ve son hareketleri bir arada.",              gor: true },
    { k: "cagrilar",   et: "Çağrılar",     ipucu: "Arzu'nun bu kişiyle görüşmeleri; ses kaydı ve transkript.",           sayi: sekmeSayilari.cagrilar, gor: true },
    { k: "wa",         et: "WhatsApp",     ipucu: "WhatsApp yazışması; buradan mesaj gönderebilirsiniz.",                sayi: sekmeSayilari.wa || undefined, gor: true },
    { k: "satis",      et: "Satışlar",     ipucu: "Kişinin siparişleri; kargola, iptal, iade işlemleri.",                sayi: sekmeSayilari.satis, gor: bayraklar.satis },
    { k: "randevu",    et: "Randevular",   ipucu: "Kişinin randevuları; takvim ve durum işlemleri.",                     sayi: sekmeSayilari.randevu, gor: bayraklar.randevu },
    { k: "cari",       et: "Cari",         ipucu: "Veresiye/borç defteri; tahsilat girişi.",                             sayi: sekmeSayilari.cari, gor: bayraklar.cari },
    { k: "abonelik",   et: "Abonelikler",  ipucu: "Kişinin düzenli/tekrar eden ödemeleri.",                              sayi: sekmeSayilari.abonelik, gor: bayraklar.abonelik },
    { k: "kayitlar",   et: "Kayıtlar",     ipucu: "Kişiye ait özel kayıt alanları (ör. TC, dosya no).",                  sayi: sekmeSayilari.kayitlar, gor: true },
    { k: "varliklar",  et: "Varlıklar",    ipucu: "Kişiye ait hayvan/araç/cihaz/mülk kayıtları.",                        sayi: sekmeSayilari.varliklar, gor: bayraklar.ozne },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
      <MobilGeri onGeri={onGeri} />
      <div className="p-3 flex flex-col gap-2.5">

        {/* HEADER — 1a lacivert şerit */}
        <div data-card className="flex items-center justify-between gap-3" style={{ background: "var(--header)", color: "var(--header-fg)", padding: "16px 22px", borderRadius: 18 }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="pjs truncate" style={{ fontSize: 21, fontWeight: 800 }}>{secili.ad}</span>
                <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.18)", padding: "3px 9px", borderRadius: 20 }}>Müşteri</span>
                {borc > 0 && (
                  <span className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, background: "#F7C1C1", color: "#791F1F", padding: "3px 9px", borderRadius: 20 }}>Borç {fmtTL(borc)}</span>
                )}
                {secili.karaListede && (
                  <span className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.18)", padding: "3px 9px", borderRadius: 20 }}><IconBan size={11} /> Kara liste</span>
                )}
              </div>
              <div className="flex items-center gap-2" style={{ marginTop: 4, opacity: .88, fontSize: 14, fontWeight: 600 }}>
                <span className="msr" style={{ fontSize: 17 }}>call</span> {secili.telefon ?? "Telefon yok"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button type="button" disabled={!secili.telefon} onClick={() => setArzuOnay(true)}
              className="flex items-center active:scale-[.95] transition-transform disabled:opacity-50"
              style={{ gap: 7, background: "#fff", color: "var(--header)", borderRadius: 11, padding: "10px 15px", fontWeight: 800, fontSize: 13 }}>
              <span className="msr" style={{ fontSize: 19 }}>call</span> Ara
            </button>
            <button type="button" disabled={!secili.telefon} onClick={whatsappAc}
              className="flex items-center active:scale-[.95] transition-transform disabled:opacity-50"
              style={{ gap: 7, background: "#25d366", color: "#0a3d1f", borderRadius: 11, padding: "10px 15px", fontWeight: 800, fontSize: 13 }}>
              <span className="msr" style={{ fontSize: 19 }}>chat</span> WhatsApp
            </button>
            <div className="flex" style={{ gap: 5, background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 5 }}>
              {bayraklar.randevu && (
                <button type="button" title="Randevu ver" onClick={() => { setRandevuBaslangicISO(""); setRandevuAcik(true); }}
                  className="grid place-items-center active:scale-[.92] transition-transform" style={{ width: 38, height: 38, borderRadius: 9, background: "transparent", color: "#fff" }}>
                  <span className="msr" style={{ fontSize: 21 }}>event</span>
                </button>
              )}
              {bayraklar.satis && (
                <button type="button" title="Sipariş gir" onClick={() => setSiparisAcik(true)}
                  className="grid place-items-center active:scale-[.92] transition-transform" style={{ width: 38, height: 38, borderRadius: 9, background: "transparent", color: "#fff" }}>
                  <span className="msr" style={{ fontSize: 21 }}>add_shopping_cart</span>
                </button>
              )}
              {bayraklar.cari && borc > 0 && (
                <button type="button" title="Tahsilat al" onClick={tahsilAc}
                  className="grid place-items-center active:scale-[.92] transition-transform" style={{ width: 38, height: 38, borderRadius: 9, background: "transparent", color: "#fff" }}>
                  <span className="msr" style={{ fontSize: 21 }}>payments</span>
                </button>
              )}
              <button type="button" title={secili.karaListede ? "Kara listede" : "Kara listeye ekle"} disabled={secili.karaListede || !secili.telefon} onClick={() => setKaraOnay(true)}
                className="grid place-items-center active:scale-[.92] transition-transform disabled:opacity-40" style={{ width: 38, height: 38, borderRadius: 9, background: "transparent", color: "#fff" }}>
                <span className="msr" style={{ fontSize: 21 }}>block</span>
              </button>
            </div>
          </div>
        </div>

        {/* STAT TILE'LARI — 1a */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile1a ikon="call" k="Toplam Arama" v={String(aramaSayisi)} />
          <StatTile1a ikon="payments" k="Toplam Satış" v={fmtTL(satisTutar)} />
          {bayraklar.cari
            ? <StatTile1a ikon="account_balance_wallet" k="Veresiye" v={fmtTL(borc)} vc={borc > 0 ? "var(--bad)" : borc < 0 ? "var(--good)" : undefined} />
            : <StatTile1a ikon="event" k="Randevu" v={String(randevular.length)} />
          }
          <StatTile1a ikon="schedule" k="Son Temas" v={fmtRelKisa(secili.sonTemas)} />
        </div>

        {/* SEKME ŞERİDİ */}
        <div className="flex items-center gap-1 flex-wrap">
          {sekmeler.filter((s) => s.gor).map((s) => {
            const aktif = sekme === s.k;
            return (
              <button
                key={s.k}
                type="button" onClick={() => setSekme(s.k)} title={s.ipucu}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[12px] font-medium transition-colors active:scale-[.97]"
                style={{
                  borderRadius: 999,
                  background: aktif ? LACI : "var(--card)",
                  color: aktif ? "#fff" : "var(--muted-foreground)",
                  border: `1px solid ${aktif ? LACI : "var(--border)"}`,
                }}
              >
                <span>{s.et}</span>
                {typeof s.sayi === "number" && s.sayi > 0 && (
                  <span className="text-[10px] px-1 py-0" style={{ borderRadius: 999, background: aktif ? "rgba(255,255,255,0.22)" : "rgba(25,54,95,0.08)", color: aktif ? "#fff" : LACI }}>{s.sayi}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* SEKME İÇERİKLERİ */}
        <div className="md-panel-in" key={sekme}>
          {sekme === "ozet" && (
            <OzetSekme
              secili={secili} kayitTarihi={kayitTarihi} borc={borc}
              aramaSayisi={aramaSayisi} satisTutar={satisTutar}
              bayraklar={bayraklar}
              notlar={notlar} setNotlar={setNotlar}
              geri={geri} setGeri={setGeri}
              notBusy={notBusy} onNotKaydet={notKaydet}
              aramalar={aramalar} satislar={satislar} konusmalar={konusmalar}
              acikCagri={acikCagri} setAcikCagri={setAcikCagri}
              urunMap={urunMap}
            />
          )}

          {sekme === "cagrilar" && (
            <CagrilarSekme aramalar={aramalar} acikCagri={acikCagri} setAcikCagri={setAcikCagri} />
          )}

          {sekme === "wa" && (
            <WaSekme
              konusmalar={konusmalar} mesajlar={waMesajlar}
              yanit={waYanit} setYanit={setWaYanit}
              busy={waGonder} onGonder={waMesajGonder}
              onWaOpen={whatsappAc}
            />
          )}

          {sekme === "satis" && (
            <BolumKart baslik="Satışlar" bosMetin="Satış kaydı yok">
              {satislar.map((s) => renderSatirSatis(s, urunMap, aksiyonBusy, setSatisOnay))}
            </BolumKart>
          )}

          {sekme === "randevu" && (
            <div className="flex flex-col gap-2.5">
              <div className="bg-card" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
                <MusteriMiniTakvim
                  kisi={{ tip: "musteri", id: secili.id, ad: secili.ad, telefon: secili.telefon }}
                  firmaId={firmaId}
                  hizmetMap={hizmetMap}
                  onRandevuVer={(t) => { setRandevuBaslangicISO(toLocalInput(t.toISOString())); setRandevuAcik(true); }}
                  yenile={takvimYenile}
                />
              </div>
              <BolumKart baslik="Yaklaşan randevular" bosMetin="Yaklaşan randevu yok">
                {randevular.filter((r) => {
                  const t = r.tarih_saat ? new Date(r.tarih_saat).getTime() : 0;
                  const k = (r.durum ?? "").toLowerCase();
                  return t > Date.now() && k !== "iptal" && k !== "tamamlandi";
                }).map((r) => renderSatirRandevu(r, hizmetMap, aksiyonBusy, setRandevuSaat, setRandevuIptalOnay))}
              </BolumKart>
            </div>
          )}

          {sekme === "cari" && (
            <BolumKart
              baslik="Veresiye hareketleri"
              bosMetin={borc === 0 ? "Kayıt yok" : `Net borç: ${fmtTL(borc)}`}
              action={borc > 0 ? (
                <IkonBtn tone="success" title="Tahsil ettim" onClick={tahsilAc}><IconCash size={13} /></IkonBtn>
              ) : null}
            >
              {cari.map((c) => {
                const borcMu = c.yon === "borc";
                return (
                  <div key={c.id} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="text-xs tabular-nums shrink-0" style={{ color: LACI, minWidth: 76 }}>{fmtDate(c.tarih)}</div>
                    <div className="flex-1 truncate text-muted-foreground">{c.aciklama ?? (borcMu ? "Borç" : "Tahsilat")}</div>
                    <div className="tabular-nums font-medium shrink-0" style={{ color: borcMu ? KIRMIZI : WA_KOYU }}>
                      {borcMu ? "+" : "−"}{fmtTL(Number(c.tutar ?? 0))}
                    </div>
                  </div>
                );
              })}
            </BolumKart>
          )}

          {sekme === "abonelik" && (
            <BolumKart baslik="Abonelikler" bosMetin="Abonelik yok">
              {abonelikler.map((a) => (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 py-2 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{a.ad ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtTL(a.tutar ?? 0)} · {a.periyot ?? "—"} · Sonraki: {a.sonraki_tahsilat ? fmtDate(a.sonraki_tahsilat) : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill tone={a.durum === "aktif" ? "success" : a.durum === "iptal" ? "danger" : "warning"}>{a.durum ?? "—"}</StatusPill>
                    {a.durum === "aktif" ? (
                      <>
                        <IkonBtn title="Duraklat" onClick={() => void abonelikDurumu(a.id, "duraklatildi")}><IconX size={13} /></IkonBtn>
                        <IkonBtn tone="danger" title="İptal" onClick={() => void abonelikDurumu(a.id, "iptal")}><IconBan size={13} /></IkonBtn>
                      </>
                    ) : a.durum === "duraklatildi" ? (
                      <IkonBtn tone="primary" title="Aktifleştir" onClick={() => void abonelikDurumu(a.id, "aktif")}><IconRepeat size={13} /></IkonBtn>
                    ) : null}
                  </div>
                </div>
              ))}
            </BolumKart>
          )}

          {sekme === "kayitlar" && (
            <div className="flex flex-col gap-2.5">
              <div className="text-caption text-muted-foreground italic">Yeni kayıt için "Kayıtlar" bölümünü kullanın.</div>
              {kKayitlar.length === 0 ? (
                <div className="bg-card p-4 text-caption text-muted-foreground" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>Kayıt yok</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {kKayitlar.map((k) => {
                    const alanlarBu = kAlanlar.filter((a) => a.tip === k.tip);
                    return (
                      <div key={k.id} className="bg-card p-3" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-body font-semibold truncate">{k.baslik ?? "(başlıksız)"}</div>
                          <div className="text-caption text-muted-foreground">{fmtDate(k.olusturuldu_at)}</div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {alanlarBu.map((a) => {
                            const v = (k.alanlar ?? {})[a.alan_adi];
                            if (v === null || v === undefined || v === "") return null;
                            return (
                              <div key={a.alan_adi} className="text-caption flex items-center gap-2">
                                <span className="text-muted-foreground">{a.etiket}:</span>
                                <span className="font-medium">{fmtKayitDeger(v, a.veri_tipi)}</span>
                                {a.gizli && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0" style={{ borderRadius: 4, background: "rgba(163,45,45,0.10)", color: KIRMIZI }}>
                                    <IconLock size={9} /> Özel
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {sekme === "varliklar" && (
            <div className="flex flex-col gap-2">
              {varliklar.length === 0 ? (
                <div className="bg-card p-4 text-caption text-muted-foreground" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>Varlık yok</div>
              ) : varliklar.map((v) => {
                const alanlar = VARLIK_ALAN[v.tip ?? "diger"] ?? [];
                const oz = (v.ozellikler ?? {}) as Record<string, unknown>;
                return (
                  <div key={v.id} className="bg-card p-3" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-body font-semibold truncate">{v.ad ?? "—"}</div>
                        {v.notlar && <div className="text-caption text-muted-foreground italic mt-0.5">{v.notlar}</div>}
                      </div>
                      <StatusPill tone="neutral">{VARLIK_TIP_ET[v.tip ?? "diger"] ?? "Diğer"}</StatusPill>
                    </div>
                    {alanlar.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {alanlar.map((a) => {
                          const val = oz[a.key];
                          if (val === null || val === undefined || String(val).trim() === "") return null;
                          return (
                            <div key={a.key} className="text-caption text-muted-foreground">
                              <span className="font-medium">{a.label}:</span> {String(val)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {yukleniyor && <div className="text-caption text-muted-foreground text-center py-2">Yükleniyor…</div>}
      </div>

      {/* ================== DIALOG'LAR ================== */}
      {randevuAcik && (
        <RandevuVerDialog
          acik={randevuAcik}
          onClose={() => setRandevuAcik(false)}
          firmaId={firmaId}
          kisi={{ tip: "musteri", id: secili.id, ad: secili.ad, telefon: secili.telefon }}
          baslangicTarih={randevuBaslangicISO || toLocalInput(new Date().toISOString())}
          onKaydedildi={async () => { setRandevuAcik(false); await tumYenile(); }}
        />
      )}
      {siparisAcik && (
        <SiparisGirDialog
          acik={siparisAcik}
          onClose={() => setSiparisAcik(false)}
          firmaId={firmaId}
          kisi={{ tip: "musteri", id: secili.id, ad: secili.ad, telefon: secili.telefon }}
          sonAdres={sonAdres}
          onKaydedildi={async () => { setSiparisAcik(false); await tumYenile(); }}
        />
      )}

      <AlertDialog open={arzuOnay} onOpenChange={setArzuOnay}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arzu {secili.ad} kişisini arasın mı?</AlertDialogTitle>
            <AlertDialogDescription>Telefon: {secili.telefon ?? "—"}. Hat bağlandığında arama başlayacak.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void arzuArasin()}>Arasın</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={karaOnay} onOpenChange={setKaraOnay}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kara listeye ekle</AlertDialogTitle>
            <AlertDialogDescription>{secili.ad} kara listeye eklenecek. Devam edilsin mi?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setKaraOnay(false); void karaListeEkle(); }}>Ekle</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!satisOnay} onOpenChange={(v) => { if (!v) setSatisOnay(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {satisOnay?.islem === "kargola" && "Bu siparişi kargolayalım mı?"}
              {satisOnay?.islem === "iade" && "Bu satışı iade alalım mı?"}
              {satisOnay?.islem === "iptal" && "Bu siparişi iptal edelim mi?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {satisOnay?.islem === "kargola" && "Kargo etiketi oluşturulacak ve durum 'Kargolandı' olarak güncellenecek."}
              {satisOnay?.islem === "iade" && "Durum 'İade' olarak güncellenecek."}
              {satisOnay?.islem === "iptal" && "Sipariş iptal olarak işaretlenecek."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void satisOnayUygula()}>
              {satisOnay?.islem === "kargola" ? "Kargola" : satisOnay?.islem === "iade" ? "İade al" : "İptal et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!randevuIptalOnay} onOpenChange={(v) => { if (!v) setRandevuIptalOnay(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randevu iptal edilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {randevuIptalOnay ? fmtDT(randevuIptalOnay.tarih_saat) : ""} tarihli randevu iptal olarak işaretlenecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void randevuIptalUygula()}>İptal et</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!randevuSaat} onOpenChange={(v) => { if (!v) setRandevuSaat(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Randevu saatini değiştir</DialogTitle></DialogHeader>
          <div className="mt-2">
            <label className="text-xs font-medium text-muted-foreground">Yeni tarih ve saat</label>
            <Input type="datetime-local" value={randevuSaat?.deger ?? ""}
              onChange={(e) => setRandevuSaat((s) => s ? { ...s, deger: e.target.value } : s)}
              className="mt-1 h-9 text-label" />
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setRandevuSaat(null)}
              className="h-9 px-3 text-sm rounded-lg border" style={{ borderColor: "var(--border)" }}>Vazgeç</button>
            <button type="button" onClick={() => void randevuSaatUygula()}
              disabled={aksiyonBusy?.startsWith("rvSaat:")}
              className="h-9 px-3 text-sm rounded-lg font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-70"
              style={{ background: LACI }}>
              {aksiyonBusy?.startsWith("rvSaat:") && <IconLoader2 size={13} className="animate-spin" />}
              Kaydet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tahsilAcik} onOpenChange={setTahsilAcik}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tahsilat ekle</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 mt-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tutar (₺)</label>
              <Input type="number" min="0" step="0.01" inputMode="decimal"
                value={tahsilForm.tutar}
                onChange={(e) => setTahsilForm((f) => ({ ...f, tutar: e.target.value }))}
                className="mt-1 h-9 text-label" />
              <div className="text-[11px] text-muted-foreground mt-1">Net borç: {fmtTL(borc)}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Açıklama (opsiyonel)</label>
              <Input type="text" value={tahsilForm.aciklama}
                onChange={(e) => setTahsilForm((f) => ({ ...f, aciklama: e.target.value }))}
                className="mt-1 h-9 text-label" />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setTahsilAcik(false)}
              className="h-9 px-3 text-sm rounded-lg border" style={{ borderColor: "var(--border)" }}>Vazgeç</button>
            <button type="button" onClick={() => void tahsilKaydet()}
              disabled={aksiyonBusy === "tahsil"}
              className="h-9 px-3 text-sm rounded-lg font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-70"
              style={{ background: WA_KOYU }}>
              {aksiyonBusy === "tahsil" && <IconLoader2 size={13} className="animate-spin" />}
              Onayla
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sekmeGorunur(k: SekmeK, b: BayrakDurumu): boolean {
  if (k === "satis") return b.satis;
  if (k === "randevu") return b.randevu;
  if (k === "cari") return b.cari;
  if (k === "abonelik") return b.abonelik;
  if (k === "varliklar") return b.ozne;
  return true;
}

/* =============================================================
   Sekme alt bileşenleri
   ============================================================= */

function OzetSekme(props: {
  secili: Kayit; kayitTarihi: string | null; borc: number;
  aramaSayisi: number; satisTutar: number;
  bayraklar: BayrakDurumu;
  notlar: string; setNotlar: (v: string) => void;
  geri: string; setGeri: (v: string) => void;
  notBusy: boolean; onNotKaydet: () => void | Promise<void>;
  aramalar: CagriDetay[]; satislar: Satis[]; konusmalar: WaKonusma[];
  acikCagri: string | null; setAcikCagri: (v: string | null) => void;
  urunMap: Map<string, string>;
}) {
  const { secili, kayitTarihi, borc, aramaSayisi, satisTutar, bayraklar,
    notlar, setNotlar, geri, setGeri, notBusy, onNotKaydet,
    aramalar, satislar, konusmalar, acikCagri, setAcikCagri, urunMap } = props;
  const l = secili.ham as MusteriRow;

  type Hareket =
    | { tip: "cagri"; iso: string; a: CagriDetay }
    | { tip: "satis"; iso: string; s: Satis }
    | { tip: "wa"; iso: string; k: WaKonusma };
  const hareketler: Hareket[] = [];
  for (const a of aramalar.slice(0, 10)) if (a.olusturuldu_at) hareketler.push({ tip: "cagri", iso: a.olusturuldu_at, a });
  for (const s of satislar.slice(0, 10)) if (s.olusturuldu_at) hareketler.push({ tip: "satis", iso: s.olusturuldu_at, s });
  for (const k of konusmalar.slice(0, 5)) if (k.son_mesaj_at) hareketler.push({ tip: "wa", iso: k.son_mesaj_at, k });
  hareketler.sort((a, b) => (a.iso < b.iso ? 1 : -1));
  const gosterHar = hareketler.slice(0, 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
      <div className="flex flex-col gap-3 min-w-0">
      {/* KİMLİK */}
      <div className="p-3.5" style={{ borderRadius: 16, border: "1px solid rgba(15,27,46,.06)", background: "linear-gradient(180deg,#ffffff,#fcfdff)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(15,27,46,.04), 0 5px 12px rgba(15,27,46,.06), 0 18px 38px rgba(15,27,46,.08)" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="grid place-items-center shrink-0" style={{ width: 30, height: 30, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)" }}><IconId size={17} /></span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>Kimlik</div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 600, marginTop: 2 }}>İletişim ve kayıt bilgileri</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <OzetHucre et="Telefon" v={secili.telefon ?? "—"} />
          <OzetHucre et="E-posta" v={l?.email ?? "—"} />
          <OzetHucre et="Adres" v={l?.adres ?? "—"} />
          <OzetHucre et="İl / İlçe" v={[secili.il, secili.ilce].filter(Boolean).join(" / ") || "—"} />
          <OzetHucre et="Kanal" v={l?.kanal ?? "—"} />
          <OzetHucre et="Kayıt" v={fmtDate(kayitTarihi)} />
          <OzetHucre et="Etiket" v={(l && "etiket" in l ? (l.etiket ?? "—") : "—")} />
          <OzetHucre et="Son temas" v={fmtDT(secili.sonTemas)} />
          {bayraklar.cari && <OzetHucre et="Veresiye" v={fmtTL(borc)} vRenk={borc > 0 ? KIRMIZI : borc < 0 ? WA_KOYU : undefined} />}
          <OzetHucre et="Toplam arama" v={String(aramaSayisi)} />
          <OzetHucre et="Toplam satış" v={fmtTL(satisTutar)} />
          <OzetHucre et="Geri arama" v={secili.geri_arama_tarihi ? fmtDT(secili.geri_arama_tarihi) : "—"} />
        </div>
      </div>

      {/* SON HAREKETLER */}
      <div className="p-3.5" style={{ borderRadius: 16, border: "1px solid rgba(15,27,46,.06)", background: "linear-gradient(180deg,#ffffff,#fcfdff)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(15,27,46,.04), 0 5px 12px rgba(15,27,46,.06), 0 18px 38px rgba(15,27,46,.08)" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="grid place-items-center shrink-0" style={{ width: 30, height: 30, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)" }}><IconHistory size={17} /></span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>Son Hareketler</div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 600, marginTop: 2 }}>Çağrı, satış ve mesaj geçmişi</div>
          </div>
        </div>
        {gosterHar.length === 0 ? (
          <div className="text-caption text-muted-foreground py-1">Hareket yok</div>
        ) : (
          <div className="flex flex-col">
            {gosterHar.map((h, i) => {
              if (h.tip === "cagri") {
                const rz = cagriSonucRozet(h.a.satis_durumu);
                const dk = h.a.sure_saniye ? Math.max(1, Math.round(h.a.sure_saniye / 60)) : 0;
                return (
                  <div key={"c" + h.a.id + i} className="flex items-center gap-2 py-1.5 px-1 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="text-xs tabular-nums shrink-0" style={{ color: LACI, minWidth: 90 }}>{fmtDT(h.a.olusturuldu_at)}</div>
                    <IconPhone size={12} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0 truncate">Arzu ile görüştü{dk ? ` · ${dk} dk` : ""}</div>
                    <span className="text-[10px] font-medium px-1.5 py-0 shrink-0" style={{ borderRadius: 20, background: rz.bg, color: rz.fg }}>{rz.et}</span>
                    <span className="shrink-0" style={{ width: 12 }} />
                  </div>
                );
              }
              if (h.tip === "satis") {
                const s = h.s;
                const ad = s.urun_id ? (urunMap.get(s.urun_id) ?? "Ürün") : "Satış";
                return (
                  <div key={"s" + s.id} className="flex items-center gap-2 py-1.5 px-1 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="text-xs tabular-nums shrink-0" style={{ color: LACI, minWidth: 90 }}>{fmtDT(s.olusturuldu_at)}</div>
                    <IconShoppingCartPlus size={12} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0 truncate">{ad} · {fmtTL(s.tutar)}</div>
                    <span className="text-[10px] font-medium px-1.5 py-0 shrink-0" style={{ borderRadius: 4, background: "rgba(29,158,117,0.12)", color: WA_KOYU }}>Satış</span>
                    <span className="shrink-0" style={{ width: 12 }} />
                  </div>
                );
              }
              return (
                <div key={"w" + h.k.id} className="flex items-center gap-2 py-1.5 px-1 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="text-xs tabular-nums shrink-0" style={{ color: LACI, minWidth: 90 }}>{fmtDT(h.k.son_mesaj_at)}</div>
                  <IconMessageCircle size={12} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 truncate">WhatsApp yazıştı</div>
                  <span className="text-[10px] font-medium px-1.5 py-0 shrink-0" style={{ borderRadius: 4, background: "rgba(29,158,117,0.12)", color: WA_KOYU }}>Mesaj</span>
                  <span className="shrink-0" style={{ width: 12 }} />
                </div>
              );

            })}
          </div>
        )}
      </div>
      </div>

      {/* NOT & GERİ ARAMA */}
      <div className="p-3.5" style={{ borderRadius: 16, border: "1px solid rgba(15,27,46,.06)", background: "linear-gradient(180deg,#ffffff,#fcfdff)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(15,27,46,.04), 0 5px 12px rgba(15,27,46,.06), 0 18px 38px rgba(15,27,46,.08)" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="grid place-items-center shrink-0" style={{ width: 30, height: 30, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)" }}><IconNotes size={17} /></span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>Not & Geri Arama</div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 600, marginTop: 2 }}>Bu müşteriye özel notlar</div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <textarea
            value={notlar}
            onChange={(e) => setNotlar(e.target.value)}
            rows={4}
            placeholder="Bu müşteri hakkında not…"
            className="w-full text-label px-2.5 py-1.5 bg-transparent resize-none"
            style={{ borderRadius: 8, border: "1px solid var(--border)" }}
          />
          <div className="flex items-center gap-2">
            <Input type="datetime-local" value={geri} onChange={(e) => setGeri(e.target.value)} className="h-8 text-label flex-1" />
            <button type="button" onClick={() => void onNotKaydet()}
              disabled={notBusy}
              className="inline-flex items-center gap-1 h-8 px-3 text-sm font-medium text-white disabled:opacity-60 active:scale-[.97]"
              style={{ borderRadius: 8, background: LACI, transitionDuration: "120ms" }}>
              {notBusy && <IconLoader2 size={13} className="animate-spin" />}
              Kaydet
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function CagrilarSekme({ aramalar }: { aramalar: CagriDetay[]; acikCagri?: string | null; setAcikCagri?: (v: string | null) => void }) {
  const [secili, setSecili] = useState<CagriDetay | null>(null);
  if (aramalar.length === 0) {
    return <div className="bg-card p-4 text-caption text-muted-foreground" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>Çağrı yok</div>;
  }
  return (
    <div className="bg-card p-3" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
      <div className="text-caption font-medium text-muted-foreground mb-2 uppercase tracking-wide">Tüm çağrılar</div>
      <div className="flex flex-col">
        {aramalar.map((a) => {
          const rz = cagriSonucRozet(a.satis_durumu);
          const sureDk = a.sure_saniye ? Math.max(1, Math.round(a.sure_saniye / 60)) : 0;
          return (
            <button key={a.id} type="button" onClick={() => setSecili(a)}
              className="w-full flex items-center gap-2 py-2 text-sm text-left px-1 transition-colors"
              style={{ borderTop: "1px solid var(--border)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(25,54,95,0.04)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}>
              <div className="text-xs tabular-nums shrink-0" style={{ color: LACI, minWidth: 90 }}>{fmtDT(a.olusturuldu_at)}</div>
              <IconPhone size={12} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 truncate">Arzu ile görüştü{sureDk ? ` · ${sureDk} dk` : ""}</div>
              <span className="text-[10px] font-medium px-1.5 py-0 shrink-0" style={{ borderRadius: 20, background: rz.bg, color: rz.fg }}>{rz.et}</span>
            </button>
          );
        })}
      </div>
      <CagriModal a={secili} onClose={() => setSecili(null)} />
    </div>
  );
}

function CagriModal({ a, onClose }: { a: CagriDetay | null; onClose: () => void }) {
  return (
    <Dialog open={!!a} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        {a && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <IconPhone size={16} /> Arzu ile görüşme
                <span className="text-xs font-normal text-muted-foreground">{fmtDT(a.olusturuldu_at)}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              {a.ses_kaydi_url ? (
                <audio controls src={a.ses_kaydi_url} className="w-full h-9" />
              ) : (
                <div className="text-caption text-muted-foreground">Ses kaydı yok</div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                <MiniAlan et="Cinsiyet" v={a.cinsiyet ?? "—"} />
                <MiniAlan et="Yaş" v={a.yas != null ? String(a.yas) : "—"} />
                <MiniAlan et="Ürün" v={a.urun_adi ?? "—"} />
                <MiniAlan et="Fiyat" v={fmtTL(a.satis_fiyati)} />
                <MiniAlan et="İtiraz" v={a.itiraz_turu ?? "—"} />
                <MiniAlan et="Adres" v={a.adres ?? "—"} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Özet</div>
                <div className="text-xs" style={{ color: LACI }}>{a.ozet?.trim() || "Özet yok"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Transkript</div>
                {a.transkript ? (
                  <div className="text-xs whitespace-pre-wrap overflow-y-auto p-2" style={{ maxHeight: 220, background: "var(--secondary)", borderRadius: 8 }}>{a.transkript}</div>
                ) : (
                  <div className="text-caption text-muted-foreground">Transkript yok</div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniAlan({ et, v }: { et: string; v: string }) {
  return (
    <div className="px-2 py-1" style={{ background: "var(--secondary)", borderRadius: 6 }}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{et}</div>
      <div className="text-xs truncate">{v}</div>
    </div>
  );
}

function WaSekme({ konusmalar, mesajlar, yanit, setYanit, busy, onGonder, onWaOpen }: {
  konusmalar: WaKonusma[]; mesajlar: WaMesaj[];
  yanit: string; setYanit: (v: string) => void;
  busy: boolean; onGonder: () => void | Promise<void>;
  onWaOpen: () => void;
}) {
  const k = konusmalar[0];
  if (!k) {
    return (
      <div className="bg-card p-4 flex flex-col items-center gap-2" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
        <div className="text-caption text-muted-foreground">Henüz WhatsApp konuşması yok</div>
        <button type="button" onClick={onWaOpen}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-sm text-white active:scale-[.97]"
          style={{ borderRadius: 8, background: WA, transitionDuration: "120ms" }}>
          <IconBrandWhatsapp size={14} /> WhatsApp'ta aç
        </button>
      </div>
    );
  }
  return (
    <div className="bg-card p-3 flex flex-col gap-2" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
      <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 380 }}>
        {mesajlar.length === 0 ? (
          <div className="text-caption text-muted-foreground py-2 text-center">Mesaj yok</div>
        ) : mesajlar.map((m) => {
          const giden = m.yon === "giden";
          return (
            <div key={m.id} className={`flex ${giden ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%] px-2.5 py-1.5 text-sm" style={{
                borderRadius: 10,
                background: giden ? LACI : "var(--card)",
                color: giden ? "#fff" : "var(--foreground)",
                border: giden ? "none" : "1px solid var(--border)",
                whiteSpace: "pre-wrap",
              }}>
                {m.icerik}
                <div className={`text-[10px] mt-0.5 ${giden ? "text-white/70" : "text-muted-foreground"}`}>{fmtDT(m.olusturuldu_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <input
          type="text" value={yanit}
          onChange={(e) => setYanit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy && yanit.trim()) void onGonder(); }}
          placeholder="Mesaj yazın…"
          className="flex-1 h-8 px-2.5 text-sm bg-transparent"
          style={{ borderRadius: 8, border: "1px solid var(--border)" }}
        />
        <button type="button" onClick={() => void onGonder()}
          disabled={busy || !yanit.trim()}
          className="grid place-items-center w-8 h-8 disabled:opacity-50 active:scale-[.94]"
          style={{ borderRadius: 8, background: WA, color: "#fff", transitionDuration: "120ms" }} title="Gönder">
          {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />}
        </button>
      </div>
    </div>
  );
}

/* Satır render yardımcıları */
function renderSatirRandevu(
  r: Randevu, hizmetMap: Map<string, string>, aksiyonBusy: string | null,
  setRandevuSaat: (v: { r: Randevu; deger: string }) => void,
  setRandevuIptalOnay: (v: Randevu) => void,
) {
  const rz = randevuRozet(r.durum);
  return (
    <div key={r.id} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="text-xs tabular-nums shrink-0" style={{ color: LACI, minWidth: 90 }}>{fmtDT(r.tarih_saat)}</div>
      <div className="flex-1 min-w-0 truncate">
        {r.hizmet_id ? (hizmetMap.get(r.hizmet_id) ?? "Hizmet") : (r.sure_dakika ? `${r.sure_dakika} dk` : "Randevu")}
      </div>
      <span className="text-caption font-medium px-1.5 py-0 shrink-0" style={{ borderRadius: 4, background: rz.bg, color: rz.fg }}>{rz.et}</span>
      <div className="flex items-center gap-1 shrink-0">
        <IkonBtn title="Saat değiştir" busy={aksiyonBusy === "rvSaat:" + r.id}
          onClick={() => setRandevuSaat({ r, deger: r.tarih_saat ? toLocalInput(r.tarih_saat) : "" })}>
          <IconClockEdit size={13} />
        </IkonBtn>
        <IkonBtn tone="danger" title="İptal" busy={aksiyonBusy === "rvIptal:" + r.id} onClick={() => setRandevuIptalOnay(r)}>
          <IconX size={13} />
        </IkonBtn>
      </div>
    </div>
  );
}

function renderSatirSatis(
  s: Satis, urunMap: Map<string, string>, aksiyonBusy: string | null,
  setSatisOnay: (v: { r: Satis; islem: "kargola" | "iade" | "iptal" }) => void,
) {
  const rz = satisRozet(s.durum);
  const ad = s.urun_id ? (urunMap.get(s.urun_id) ?? "Ürün") : "Satış";
  const k = (s.durum ?? "beklemede").toLowerCase();
  const kargoAsama = k === "beklemede" || k === "onaylandi";
  const kargoVar = k === "kargolandi" || k === "teslim_edildi";
  const teslimAsama = k === "kargolandi";
  const txtBtn = (t: "kargola" | "iptal" | "iade", et: string, tone: "accent" | "danger" | "neutral") => {
    const busy = aksiyonBusy === t + ":" + s.id;
    const c = tone === "accent"
      ? { color: "var(--accent)", border: "1px solid var(--accent)" }
      : tone === "danger"
        ? { color: "var(--bad)", border: "1px solid rgba(220,38,38,0.4)" }
        : { color: "var(--muted)", border: "1px solid var(--line)" };
    return (
      <button type="button" disabled={busy}
        onClick={() => setSatisOnay({ r: s, islem: t })}
        className="active:scale-[.97] transition-transform disabled:opacity-50"
        style={{ ...c, background: "transparent", borderRadius: 8, padding: "5px 12px", fontSize: 12.5, fontWeight: 700 }}>
        {busy ? "…" : et}
      </button>
    );
  };
  return (
    <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="tabular-nums shrink-0" style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, minWidth: 96 }}>{fmtDT(s.olusturuldu_at)}</div>
      <div className="flex-1 min-w-0 truncate" style={{ fontSize: 13.5 }}>
        {ad}
        {s.adet ? <span style={{ color: "var(--muted)" }}> · {s.adet}×</span> : null}
        <span style={{ color: "var(--muted)" }}> · </span><b style={{ fontWeight: 700 }}>{fmtTL(s.tutar)}</b>
      </div>
      <span className="shrink-0" style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: rz.bg, color: rz.fg }}>{rz.et}</span>
      <div className="flex items-center gap-2 shrink-0">
        {kargoAsama ? (
          <>
            {txtBtn("kargola", "Kargola", "accent")}
            {txtBtn("iptal", "İptal", "danger")}
          </>
        ) : kargoVar ? (
          <>
            <span className="shrink-0" style={{ fontSize: 11, color: "var(--muted)", padding: "3px 9px", borderRadius: 8, background: "var(--secondary)" }}>Kargo var</span>
            {teslimAsama && txtBtn("iade", "İade", "neutral")}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* =============================================================
   Küçük yardımcı bileşenler & format
   ============================================================= */

function basHarf(ad: string): string {
  const s = (ad ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function OzetHucre({ et, v, vRenk }: { et: string; v: string; vRenk?: string }) {
  if (!v || v === "—") return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{et}</div>
      <div className="text-[13px] font-semibold truncate" style={{ color: vRenk ?? "var(--foreground)" }} title={v}>{v}</div>
    </div>
  );
}

function BilgiSatir({ et, v, vRenk }: { et: string; v: string; vRenk?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{et}</dt>
      <dd className="font-medium text-right truncate" style={{ color: vRenk ?? "var(--foreground)" }}>{v}</dd>
    </>
  );
}

function BolumKart({
  baslik, bosMetin, action, children,
}: { baslik: string; bosMetin: string; action?: React.ReactNode; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const dolu = arr.some((c) => !!c);
  return (
    <div className="bg-card p-3" style={{ borderRadius: 12, border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-caption font-medium text-muted-foreground uppercase tracking-wide">{baslik}</div>
        {action}
      </div>
      {dolu ? <div>{children}</div> : <div className="text-caption text-muted-foreground py-1">{bosMetin}</div>}
    </div>
  );
}

function MobilGeri({ onGeri }: { onGeri: () => void }) {
  return (
    <div className="lg:hidden shrink-0 flex items-center gap-1 p-2 border-b" style={{ borderColor: "var(--border)" }}>
      <button type="button" onClick={onGeri}
        className="inline-flex items-center gap-1 text-sm font-medium py-1 px-2 rounded-lg hover:bg-secondary"
        style={{ color: LACI }}>
        <IconChevronLeft size={15} />
        <span>Listeye dön</span>
      </button>
    </div>
  );
}

function randevuRozet(d: string | null): { et: string; bg: string; fg: string } {
  const k = (d ?? "").toLowerCase();
  if (k === "tamamlandi") return { et: "Tamamlandı", bg: "rgba(29,158,117,0.12)", fg: WA_KOYU };
  if (k === "iptal") return { et: "İptal", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  if (k === "onaylandi" || k === "beklemede") return { et: "Yaklaşan", bg: "rgba(24,95,165,0.12)", fg: MAVI };
  return { et: d ?? "—", bg: "rgba(100,116,139,0.12)", fg: "#475569" };
}
function satisRozet(d: string | null): { et: string; bg: string; fg: string } {
  const k = (d ?? "").toLowerCase();
  if (k === "beklemede") return { et: "Beklemede", bg: "rgba(133,79,11,0.14)", fg: SARI };
  if (k === "onaylandi") return { et: "Onaylandı", bg: "rgba(24,95,165,0.12)", fg: MAVI };
  if (k === "kargolandi") return { et: "Kargolandı", bg: "rgba(29,158,117,0.12)", fg: WA_KOYU };
  if (k === "teslim_edildi" || k === "tamamlandi") return { et: "Teslim", bg: "rgba(29,158,117,0.12)", fg: WA_KOYU };
  if (k === "iptal") return { et: "İptal", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  if (k === "iade") return { et: "İade", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  return { et: d ?? "—", bg: "rgba(100,116,139,0.12)", fg: "#475569" };
}
function cagriSonucRozet(d: string | null): { et: string; bg: string; fg: string } {
  const k = (d ?? "").toLowerCase();
  if (k === "satis" || k === "satildi") return { et: "Satıldı", bg: "rgba(29,158,117,0.12)", fg: WA_KOYU };
  if (k === "satilmadi") return { et: "Satılmadı", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  if (k === "ilgilendi") return { et: "İlgilendi", bg: "rgba(24,95,165,0.12)", fg: MAVI };
  if (k === "geri_aranacak") return { et: "Geri aranacak", bg: "rgba(133,79,11,0.14)", fg: SARI };
  if (k === "ilgilenmedi") return { et: "İlgilenmedi", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  if (k === "ulasilamadi") return { et: "Ulaşılamadı", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  if (k === "mesgul") return { et: "Meşgul", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  const cap = d ? d.charAt(0).toLocaleUpperCase("tr") + d.slice(1) : "—";
  return { et: cap, bg: "rgba(100,116,139,0.12)", fg: "#475569" };
}

/* Kayıt değer biçimlendirme — KayitlarListe deseni */
function fmtKayitDeger(v: unknown, tip: string): string {
  if (v == null || v === "") return "—";
  try {
    if (tip === "para") {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isNaN(n)) return String(v);
      return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
    }
    if (tip === "tarih") {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
    }
    if (tip === "bool") return v ? "Evet" : "Hayır";
    return String(v);
  } catch { return String(v); }
}

/* Varlık alan haritası — varliklar.tsx deseniyle aynı */
const VARLIK_ALAN: Record<string, { key: string; label: string }[]> = {
  hayvan: [{ key: "tur", label: "Tür" }, { key: "irk", label: "Irk" }, { key: "yas", label: "Yaş" }, { key: "kilo", label: "Kilo" }],
  arac: [{ key: "plaka", label: "Plaka" }, { key: "marka", label: "Marka" }, { key: "model", label: "Model" }, { key: "yil", label: "Yıl" }],
  cihaz: [{ key: "marka", label: "Marka" }, { key: "model", label: "Model" }, { key: "seri_no", label: "Seri No" }],
  mulk: [{ key: "adres", label: "Adres" }, { key: "tur", label: "Tür" }],
  diger: [],
};
const VARLIK_TIP_ET: Record<string, string> = {
  hayvan: "Hayvan", arac: "Araç", cihaz: "Cihaz", mulk: "Mülk", diger: "Diğer",
};

/* =============================================================
   Arama Listesine Ekle Dialog — CagriListeleriPanel deseni
   ============================================================= */
type Liste = { id: string; liste_adi: string | null };

function AramaListeyeEkleDialog({
  acik, onClose, firmaId, kisiler, onTamam,
}: {
  acik: boolean; onClose: () => void; firmaId: string;
  kisiler: Kayit[]; onTamam: () => void;
}) {
  const [listeler, setListeler] = useState<Liste[]>([]);
  const [yeniAd, setYeniAd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!acik || !firmaId) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("cagri_listeleri")
        .select("id, liste_adi").eq("firma_id", firmaId).order("liste_adi", { ascending: true });
      if (!iptal) setListeler((data as Liste[] | null) ?? []);
    })();
    return () => { iptal = true; };
  }, [acik, firmaId]);

  function normalizeTel(t: string | null): string | null {
    if (!t) return null;
    const raw = t.replace(/\D/g, "");
    if (raw.length === 10) return "+90" + raw;
    if (raw.length === 11 && raw.startsWith("0")) return "+90" + raw.slice(1);
    if (raw.length === 12 && raw.startsWith("90")) return "+" + raw;
    if (raw.length >= 10) return "+" + raw;
    return null;
  }

  async function listeyeEkle(listeId: string) {
    if (busy) return;
    setBusy(true);
    try {
      let eklenen = 0, atlanan = 0;
      const rows: {
        liste_id: string; firma_id: string; ad_soyad: string | null; telefon: string;
        arama_durumu: string; deneme_sayisi: number; musteri_id: string | null;
      }[] = [];
      for (const k of kisiler) {
        const telN = normalizeTel(k.telefon);
        if (!telN) { atlanan++; continue; }
        let musteriId: string | null = null;
        const { data: pid, error: pErr } = await supabase.rpc("fn_party_bul_veya_olustur" as never, {
          p_firma_id: firmaId, p_telefon: telN, p_ad: k.ad || null,
        } as never);
        if (!pErr && pid) musteriId = pid as unknown as string;
        rows.push({
          liste_id: listeId, firma_id: firmaId, ad_soyad: k.ad || null, telefon: telN,
          arama_durumu: "beklemede", deneme_sayisi: 0, musteri_id: musteriId,
        });
        eklenen++;
      }
      if (rows.length === 0) { toast.error(`Eklenecek kişi yok (${atlanan} telefonsuz atlandı)`); return; }
      const { error } = await supabase.from("liste_kisileri").insert(rows);
      if (error) { toast.error("Eklenemedi: " + error.message); return; }
      toast.success(atlanan > 0
        ? `${eklenen} kişi eklendi, ${atlanan} telefonsuz atlandı`
        : `${eklenen} kişi eklendi`);
      onTamam();
    } finally { setBusy(false); }
  }

  async function yeniOlustur() {
    if (!yeniAd.trim()) { toast.error("Liste adı gerekli"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("cagri_listeleri").insert({
      firma_id: firmaId, liste_adi: yeniAd.trim(), durum: "aktif",
      iys_izinli: true, iys_onay_tarihi: new Date().toISOString(),
      toplam_kisi: 0, aranan_kisi: 0,
      arama_baslangic_saat: "10:00", arama_bitis_saat: "18:00",
    }).select("id, liste_adi").single();
    setBusy(false);
    if (error || !data) { toast.error("Liste oluşturulamadı: " + (error?.message ?? "")); return; }
    await listeyeEkle((data as Liste).id);
  }

  return (
    <Dialog open={acik} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Arama listesine ekle</DialogTitle></DialogHeader>
        <div className="text-caption text-muted-foreground mb-2">{kisiler.length} kişi seçili</div>

        <div className="text-caption font-medium text-muted-foreground uppercase tracking-wide mb-1">Mevcut liste seç</div>
        {listeler.length === 0 ? (
          <div className="text-caption text-muted-foreground mb-2">Henüz liste yok.</div>
        ) : (
          <ul className="flex flex-col gap-1 mb-3 max-h-56 overflow-y-auto">
            {listeler.map((l) => (
              <li key={l.id}>
                <button type="button" disabled={busy} onClick={() => void listeyeEkle(l.id)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm text-left hover:bg-secondary disabled:opacity-60"
                  style={{ border: "1px solid var(--border)" }}>
                  <span className="truncate" style={{ color: LACI }}>{l.liste_adi ?? "—"}</span>
                  <span className="text-caption text-muted-foreground shrink-0">Ekle →</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="text-caption font-medium text-muted-foreground uppercase tracking-wide mb-1">Yeni liste oluştur</div>
          <div className="flex items-center gap-2">
            <Input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Liste adı"
              className="h-9 text-label flex-1" />
            <button type="button" disabled={busy || !yeniAd.trim()} onClick={() => void yeniOlustur()}
              className="h-9 px-3 rounded-lg text-white text-sm font-medium inline-flex items-center gap-1 disabled:opacity-60"
              style={{ background: LACI }}>
              <IconPlus size={14} /> Oluştur
            </button>
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={onClose}
            className="h-9 px-3 text-sm rounded-lg border" style={{ borderColor: "var(--border)" }}>Kapat</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Bilinçli olarak kullanılmıyor — referans korunuyor (noUnusedLocals) */
void StatCard; void MiniStat; void BeyazAksiyon; void LACI_KOYU;
void IconSearch; void IconCalendarPlus; void IconPhoneCall;
void Ipucu;

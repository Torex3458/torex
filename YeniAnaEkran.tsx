import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useFirmaId } from "@/lib/use-firma-id";
import { useFirmaAdi } from "@/lib/use-firma-adi";
import { CountUp } from "@/components/system/CountUp";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MinuteBalanceKpi } from "@/components/dashboard/MinuteBalanceKpi";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { OutcomeDonut } from "@/components/dashboard/OutcomeDonut";
import { HourlyBars } from "@/components/dashboard/HourlyBars";
import { TurkiyeSatisHarita, normalizeIl } from "@/components/dashboard/TurkiyeSatisHarita";

const LACI = "#19365F";

function selamla() {
  const h = new Date().getHours();
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}
function fmtTL(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Pano = {
  kpiCagri: number; kpiSatis: number; kpiCiro: number;
  cagriSpark: number[]; satisSpark: number[]; ciroSpark: number[];
  trend: { d: string; cagri: number; satis: number }[];
  outcome: { name: string; value: number; color: string }[];
  hourly: { h: string; v: number }[];
  ilSatis: Record<string, number>;
  bugunCagri: number; bugunSatis: number; bugunCiro: number; bugunRandevu: number;
  urunler: { ad: string; adet: number }[];
};

const BOS_PANO: Pano = {
  kpiCagri: 0, kpiSatis: 0, kpiCiro: 0, cagriSpark: [], satisSpark: [], ciroSpark: [],
  trend: [], outcome: [], hourly: [], ilSatis: {},
  bugunCagri: 0, bugunSatis: 0, bugunCiro: 0, bugunRandevu: 0, urunler: [],
};

function usePano(firmaId: string, missing: boolean): Pano {
  const [pano, setPano] = useState<Pano>(BOS_PANO);
  useEffect(() => {
    if (missing || !firmaId) return;
    let iptal = false;
    (async () => {
      const now = new Date();
      const bas30 = new Date(now); bas30.setDate(bas30.getDate() - 29);
      const bas30ISO = new Date(bas30.getFullYear(), bas30.getMonth(), bas30.getDate()).toISOString();
      const bugunISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const yarinISO = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const [aramaRes, satisRes, randevuRes, urunRes] = await Promise.all([
        supabase.from("aramalar").select("olusturuldu_at, satis_durumu, il").eq("firma_id", firmaId).gte("olusturuldu_at", bas30ISO),
        supabase.from("satislar").select("tutar, olusturuldu_at, urun_id").eq("firma_id", firmaId).gte("olusturuldu_at", bas30ISO),
        supabase.from("randevular").select("id", { head: true, count: "exact" }).eq("firma_id", firmaId).gte("tarih_saat", bugunISO).lt("tarih_saat", yarinISO),
        supabase.from("urunler").select("id, ad").eq("firma_id", firmaId),
      ]);
      if (iptal) return;

      const aramalar = (aramaRes.data as { olusturuldu_at: string; satis_durumu: string | null; il: string | null }[] | null) ?? [];
      const satislar = (satisRes.data as { tutar: number | null; olusturuldu_at: string; urun_id: string | null }[] | null) ?? [];
      const urunMap = new Map<string, string>();
      for (const u of ((urunRes.data as { id: string; ad: string | null }[] | null) ?? [])) urunMap.set(u.id, u.ad ?? "Ürün");

      // Günlük seriler (son 14 gün) + spark (son 12 gün)
      const gunler: string[] = [];
      for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); gunler.push(ymd(d)); }
      const cagriGun: Record<string, number> = {}; const satisGun: Record<string, number> = {}; const ciroGun: Record<string, number> = {};
      for (const g of gunler) { cagriGun[g] = 0; satisGun[g] = 0; ciroGun[g] = 0; }
      for (const a of aramalar) { const g = a.olusturuldu_at.slice(0, 10); if (g in cagriGun) cagriGun[g] += 1; }
      for (const s of satislar) { const g = s.olusturuldu_at.slice(0, 10); if (g in satisGun) { satisGun[g] += 1; ciroGun[g] += Number(s.tutar ?? 0); } }
      const trend = gunler.map((g) => ({ d: g.slice(8, 10), cagri: cagriGun[g], satis: satisGun[g] }));
      const cagriSpark = gunler.slice(2).map((g) => cagriGun[g]);
      const satisSpark = gunler.slice(2).map((g) => satisGun[g]);
      const ciroSpark = gunler.slice(2).map((g) => ciroGun[g]);

      // Sonuç dağılımı
      const grupla: Record<string, { name: string; color: string; n: number }> = {
        satis: { name: "Satış", color: "#15803d", n: 0 },
        ilgilendi: { name: "İlgilendi", color: "#2b5aa0", n: 0 },
        geri: { name: "Geri aranacak", color: "#b45309", n: 0 },
        ulasilamadi: { name: "Ulaşılamadı", color: "#94a3b8", n: 0 },
        diger: { name: "Diğer", color: "#c8ccd8", n: 0 },
      };
      for (const a of aramalar) {
        const k = (a.satis_durumu ?? "").toLowerCase();
        if (k === "satis" || k === "satildi") grupla.satis.n += 1;
        else if (k === "ilgilendi") grupla.ilgilendi.n += 1;
        else if (k === "geri_aranacak") grupla.geri.n += 1;
        else if (k === "ulasilamadi" || k === "mesgul") grupla.ulasilamadi.n += 1;
        else grupla.diger.n += 1;
      }
      const outcome = Object.values(grupla).filter((x) => x.n > 0).map((x) => ({ name: x.name, value: x.n, color: x.color }));

      // Saatlik
      const saatSay: number[] = new Array(24).fill(0);
      for (const a of aramalar) { const h = new Date(a.olusturuldu_at).getHours(); saatSay[h] += 1; }
      const hourly = [];
      for (let h = 8; h <= 20; h++) hourly.push({ h: String(h).padStart(2, "0"), v: saatSay[h] });

      // İl bazında satış (satışla sonuçlanan aramalar)
      const ilSatis: Record<string, number> = {};
      for (const a of aramalar) {
        const k = (a.satis_durumu ?? "").toLowerCase();
        if ((k === "satis" || k === "satildi") && a.il) { const il = normalizeIl(a.il); ilSatis[il] = (ilSatis[il] ?? 0) + 1; }
      }

      // Ürün sıralaması
      const urunSay: Record<string, number> = {};
      for (const s of satislar) { if (s.urun_id) { const ad = urunMap.get(s.urun_id) ?? "Ürün"; urunSay[ad] = (urunSay[ad] ?? 0) + 1; } }
      const urunler = Object.entries(urunSay).map(([ad, adet]) => ({ ad, adet })).sort((a, b) => b.adet - a.adet).slice(0, 5);

      // Bugün
      const bg = ymd(now);
      const bugunCagri = aramalar.filter((a) => a.olusturuldu_at.slice(0, 10) === bg).length;
      const bugunSatisArr = satislar.filter((s) => s.olusturuldu_at.slice(0, 10) === bg);
      const bugunSatis = bugunSatisArr.length;
      const bugunCiro = bugunSatisArr.reduce((t, s) => t + Number(s.tutar ?? 0), 0);

      setPano({
        kpiCagri: aramalar.length, kpiSatis: satislar.length,
        kpiCiro: satislar.reduce((t, s) => t + Number(s.tutar ?? 0), 0),
        cagriSpark, satisSpark, ciroSpark, trend, outcome, hourly, ilSatis,
        bugunCagri, bugunSatis, bugunCiro, bugunRandevu: randevuRes.count ?? 0, urunler,
      });
    })();
    return () => { iptal = true; };
  }, [firmaId, missing]);
  return pano;
}

function useKredi(firmaId: string, missing: boolean) {
  const [k, setK] = useState<{ kalan: number; toplam: number } | null>(null);
  useEffect(() => {
    if (missing || !firmaId) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("dakika_cuzdani").select("kalan_kredi, toplam_kredi").eq("firma_id", firmaId).maybeSingle();
      const d = data as { kalan_kredi?: number; toplam_kredi?: number } | null;
      if (!iptal) setK({ kalan: d?.kalan_kredi ?? 0, toplam: d?.toplam_kredi ?? d?.kalan_kredi ?? 0 });
    })();
    return () => { iptal = true; };
  }, [firmaId, missing]);
  return k;
}

function Anahtar({ acik, onToggle, etiketAcik, etiketKapali, renk }: { acik: boolean; onToggle: () => void; etiketAcik: string; etiketKapali: string; renk: string }) {
  return (
    <button type="button" onClick={onToggle}
      className="inline-flex items-center gap-2 active:scale-[.97] transition-transform"
      style={{ background: acik ? "var(--accent-soft, #e7ecf5)" : "#f1f3f8", border: "1px solid var(--line, #e6eaf1)", borderRadius: 999, padding: "7px 12px 7px 8px", fontSize: 12.5, fontWeight: 700, color: acik ? renk : "#66708a" }}>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: acik ? renk : "#c4ccdb", position: "relative", transition: "background .2s", display: "inline-block" }}>
        <span style={{ position: "absolute", top: 2, left: acik ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
      </span>
      {acik ? etiketAcik : etiketKapali}
    </button>
  );
}

export function YeniAnaEkran() {
  const { firmaId, missing } = useFirmaId();
  const { ad: firmaAdi } = useFirmaAdi();
  const pano = usePano(firmaId, missing);
  const kredi = useKredi(firmaId, missing);

  const [arzuAktif, setArzuAktif] = useState<boolean>(false);
  const [waAktif, setWaAktif] = useState<boolean>(false);
  useEffect(() => {
    if (missing || !firmaId) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("firmalar").select("arzu_aktif, whatsapp_aktif").eq("id", firmaId).maybeSingle();
      const d = data as { arzu_aktif?: boolean; whatsapp_aktif?: boolean } | null;
      if (!iptal) { setArzuAktif(d?.arzu_aktif ?? false); setWaAktif(d?.whatsapp_aktif ?? false); }
    })();
    return () => { iptal = true; };
  }, [firmaId, missing]);

  async function toggleArzu() {
    if (!firmaId) return;
    const y = !arzuAktif; setArzuAktif(y);
    await supabase.from("firmalar").update({ arzu_aktif: y }).eq("id", firmaId);
  }
  async function toggleWa() {
    if (!firmaId) return;
    const y = !waAktif; setWaAktif(y);
    await supabase.from("firmalar").update({ whatsapp_aktif: y }).eq("id", firmaId);
  }

  const krediPct = kredi && kredi.toplam > 0 ? Math.round((kredi.kalan / kredi.toplam) * 100) : 0;
  const urunMax = useMemo(() => Math.max(1, ...pano.urunler.map((u) => u.adet)), [pano.urunler]);

  return (
    <div className="w-full h-[100dvh] overflow-y-auto mw1a-root" style={{ fontFamily: "'Manrope', system-ui, sans-serif", background: "#f4f6fa", color: "#0f1b2e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        @keyframes aInHome{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .home-card{opacity:0;animation:aInHome .5s ease forwards}
        .pjs2{font-family:'Plus Jakarta Sans',sans-serif}
        .mw1a-root{--accent:#19365F;--accent-soft:#e7ecf5;--line:#e6eaf1;}
      `}</style>

      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-3.5">
        {/* HEADER */}
        <div className="home-card flex items-center justify-between gap-3 flex-wrap" style={{ background: "#fff", border: "1px solid #e6eaf1", borderRadius: 16, padding: "14px 20px" }}>
          <div className="min-w-0">
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "#66708a" }}>{selamla()}</div>
            <div className="pjs2 truncate" style={{ fontSize: 18, fontWeight: 800 }}>{firmaAdi || "Firmam"}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Anahtar acik={arzuAktif} onToggle={toggleArzu} etiketAcik="Arzu açık" etiketKapali="Arzu kapalı" renk={LACI} />
            <Anahtar acik={waAktif} onToggle={toggleWa} etiketAcik="WhatsApp açık" etiketKapali="WhatsApp kapalı" renk="#16a34a" />
          </div>
        </div>

        {/* BUGÜN + KREDİ */}
        <div className="home-card flex items-center justify-between gap-5 flex-wrap" style={{ borderRadius: 16, padding: "16px 22px", color: "#eaf0fb", background: "linear-gradient(120deg,#19365F,#274b7f)" }}>
          <div className="flex items-center gap-7 flex-wrap">
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", opacity: .8, fontWeight: 700 }}>Bugün</div>
            <div><div className="pjs2" style={{ fontSize: 23, fontWeight: 800 }}><CountUp value={pano.bugunCagri} /></div><div style={{ fontSize: 11, opacity: .82 }}>Çağrı</div></div>
            <div><div className="pjs2" style={{ fontSize: 23, fontWeight: 800 }}><CountUp value={pano.bugunSatis} /></div><div style={{ fontSize: 11, opacity: .82 }}>Satış</div></div>
            <div><div className="pjs2" style={{ fontSize: 23, fontWeight: 800 }}>{fmtTL(pano.bugunCiro)}</div><div style={{ fontSize: 11, opacity: .82 }}>Ciro</div></div>
            <div><div className="pjs2" style={{ fontSize: 23, fontWeight: 800 }}><CountUp value={pano.bugunRandevu} /></div><div style={{ fontSize: 11, opacity: .82 }}>Randevu</div></div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, opacity: .82 }}>Kredi bakiyesi</div>
              <div className="pjs2" style={{ fontSize: 20, fontWeight: 800 }}>{kredi ? kredi.kalan.toLocaleString("tr-TR") : "…"} <span style={{ fontSize: 12, opacity: .8 }}>kredi</span></div>
            </div>
            <Link to="/dakika" className="active:scale-[.97] transition-transform" style={{ background: "#fff", color: LACI, borderRadius: 11, padding: "9px 16px", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>Kredi Al</Link>
          </div>
        </div>

        {/* KPI */}
        <div className="home-card grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard title="Toplam çağrı" value={pano.kpiCagri.toLocaleString("tr-TR")} delta="Son 30 gün" variant="line" color="#2b5aa0" data={pano.cagriSpark} />
          <KpiCard title="Toplam satış" value={pano.kpiSatis.toLocaleString("tr-TR")} delta="Son 30 gün" variant="bar" color="#2b5aa0" data={pano.satisSpark} />
          <KpiCard title="Toplam ciro" value={fmtTL(pano.kpiCiro)} delta="Son 30 gün" variant="line" color={LACI} data={pano.ciroSpark} />
          <MinuteBalanceKpi used={kredi?.kalan ?? 0} total={kredi?.toplam ?? 0} />
        </div>

        {/* GRAFİKLER */}
        <div className="home-card grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div style={{ background: "#fff", border: "1px solid #e6eaf1", borderRadius: 16, padding: 15 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Çağrı & Satış Trendi <span style={{ fontSize: 11, color: "#66708a", fontWeight: 600 }}>· 14 gün</span></div>
            <div style={{ height: 190 }}><TrendChart data={pano.trend.length >= 2 ? pano.trend : undefined} /></div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e6eaf1", borderRadius: 16, padding: 15 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Çağrı Sonuçları</div>
            <OutcomeDonut data={pano.outcome.length ? pano.outcome : undefined} centerLabel={pano.kpiCagri.toLocaleString("tr-TR")} />
          </div>
          <div style={{ background: "#fff", border: "1px solid #e6eaf1", borderRadius: 16, padding: 15 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Saatlik Yoğunluk</div>
            <div style={{ height: 170 }}><HourlyBars data={pano.hourly.some((h) => h.v > 0) ? pano.hourly : undefined} /></div>
          </div>
        </div>

        {/* HARİTA + ÜRÜNLER */}
        <div className="home-card grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
          <div style={{ background: "#fff", border: "1px solid #e6eaf1", borderRadius: 16, padding: 15 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Türkiye Satış Haritası</div>
            <TurkiyeSatisHarita salesByIl={pano.ilSatis} />
          </div>
          <div style={{ background: "#fff", border: "1px solid #e6eaf1", borderRadius: 16, padding: 15 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>En Çok Satan</div>
            {pano.urunler.length === 0 ? (
              <div style={{ fontSize: 13, color: "#66708a" }}>Henüz satış yok.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {pano.urunler.map((u) => (
                  <div key={u.ad} className="flex items-center gap-2.5" style={{ fontSize: 13 }}>
                    <span className="truncate" style={{ minWidth: 96, maxWidth: 96 }}>{u.ad}</span>
                    <span style={{ flex: 1, height: 8, borderRadius: 6, background: "#e7ecf5", overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${(u.adet / urunMax) * 100}%`, background: "linear-gradient(90deg,#19365F,#3a67ad)", borderRadius: 6 }} />
                    </span>
                    <span style={{ fontWeight: 700, minWidth: 30, textAlign: "right" }}>{u.adet}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

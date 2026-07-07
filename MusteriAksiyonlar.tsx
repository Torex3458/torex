import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Calendar as CalIcon,
  ShoppingCart,
  Phone,
  MessageCircle,
  UserPlus,
  Loader2,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { tr } from "date-fns/locale";



const LACIVERT = "#19365F";

const kartStil: CSSProperties = {
  background: "var(--card)",
  borderColor: "var(--border)",
  borderRadius: 12,
};

type Kisi = {
  tip: "musteri" | "aday";
  id: string;
  ad: string;
  telefon: string | null;
};

type Hizmet = { id: string; hizmet_adi: string | null };
type Urun = { id: string; ad: string | null; fiyat: number | null };

function nowLocalInput(base?: Date): string {
  const d = base ?? new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtTL(v: number | null | undefined): string {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${v} ₺`;
  }
}
function fmtSaat(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ============================================================
   4 TEK TUŞ (veya aday için Müşteri yap)
   ============================================================ */

export function MusteriAksiyonBar({
  kisi,
  firmaId,
  onYenile,
  sonAdres,
  acilRandevuTarih,
  onAcilTuketildi,
}: {
  kisi: Kisi;
  firmaId: string;
  onYenile: () => void | Promise<void>;
  sonAdres?: { adres: string | null; il: string | null; ilce: string | null } | null;
  /** Takvimden gelen açma isteği — değişince Randevu dialog'u bu tarihle açılır */
  acilRandevuTarih?: Date | null;
  onAcilTuketildi?: () => void;
}) {
  const navigate = useNavigate();
  const [randevuAcik, setRandevuAcik] = useState(false);
  const [randevuTarih, setRandevuTarih] = useState<string>(nowLocalInput());
  const [siparisAcik, setSiparisAcik] = useState(false);
  const [arzuOnay, setArzuOnay] = useState(false);
  const [mesajAcik, setMesajAcik] = useState(false);
  const [musteriYapBusy, setMusteriYapBusy] = useState(false);

  const acRandevu = useCallback((tarih?: Date) => {
    setRandevuTarih(nowLocalInput(tarih));
    setRandevuAcik(true);
  }, []);

  // Dışarıdan (takvimden) tarih gelirse dialog'u aç
  useEffect(() => {
    if (acilRandevuTarih) {
      acRandevu(acilRandevuTarih);
      onAcilTuketildi?.();
    }
  }, [acilRandevuTarih, acRandevu, onAcilTuketildi]);

  // Aday ise: sadece "Müşteri yap"
  if (kisi.tip === "aday") {
    async function musteriYap() {
      if (musteriYapBusy) return;
      const tel = (kisi.telefon ?? "").trim();
      if (!tel) { toast.error("Telefon numarası yok, müşteri oluşturulamaz."); return; }
      setMusteriYapBusy(true);
      try {
        const { error } = await supabase.from("musteriler").upsert(
          {
            firma_id: firmaId,
            telefon: tel,
            ad_soyad: kisi.ad || null,
            guncellendi_at: new Date().toISOString(),
          },
          { onConflict: "firma_id,telefon" },
        );
        if (error) { toast.error("Müşteri oluşturulamadı: " + error.message); return; }
        toast.success("Müşteri kaydı oluşturuldu.");
        await onYenile();
      } finally {
        setMusteriYapBusy(false);
      }
    }
    return (
      <div className="grid grid-cols-1">
        <button
          type="button"
          onClick={() => void musteriYap()}
          disabled={musteriYapBusy}
          className="h-11 rounded-xl inline-flex items-center justify-center gap-2 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: LACIVERT }}
        >
          {musteriYapBusy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          <span className="text-sm">Müşteri yap</span>
        </button>
      </div>
    );
  }

  const tuslar = [
    { k: "randevu", et: "Randevu ver", I: CalIcon, on: () => acRandevu() },
    { k: "siparis", et: "Sipariş gir", I: ShoppingCart, on: () => setSiparisAcik(true) },
    { k: "arzu", et: "Arzu arasın", I: Phone, on: () => setArzuOnay(true) },
    { k: "mesaj", et: "Mesaj at", I: MessageCircle, on: () => setMesajAcik(true) },
  ] as const;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {tuslar.map((t) => {
          const Ico = t.I;
          return (
            <button
              key={t.k}
              type="button"
              onClick={t.on}
              className="h-11 rounded-xl inline-flex items-center justify-center gap-2 font-medium transition-all"
              style={{
                background: "rgba(25,54,95,0.06)",
                color: LACIVERT,
                border: "1px solid rgba(25,54,95,0.10)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = LACIVERT;
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(25,54,95,0.06)";
                e.currentTarget.style.color = LACIVERT;
              }}
            >
              <Ico size={15} />
              <span className="text-[13px]">{t.et}</span>
            </button>
          );
        })}
      </div>

      {/* Randevu ver */}
      {randevuAcik && (
        <RandevuVerDialog
          acik={randevuAcik}
          onClose={() => setRandevuAcik(false)}
          firmaId={firmaId}
          kisi={kisi}
          baslangicTarih={randevuTarih}
          onKaydedildi={async () => { setRandevuAcik(false); await onYenile(); }}
        />
      )}
      {/* Sipariş gir */}
      {siparisAcik && (
        <SiparisGirDialog
          acik={siparisAcik}
          onClose={() => setSiparisAcik(false)}
          firmaId={firmaId}
          kisi={kisi}
          sonAdres={sonAdres ?? null}
          onKaydedildi={async () => { setSiparisAcik(false); await onYenile(); }}
        />
      )}
      {/* Arzu arasın onay */}
      <AlertDialog open={arzuOnay} onOpenChange={setArzuOnay}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arzu şimdi {kisi.ad} kişisini arasın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Telefon: {kisi.telefon ?? "—"}. Hat bağlandığında arama başlayacak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setArzuOnay(false);
                const tel = (kisi.telefon ?? "").replace(/\s+/g, "");
                if (tel.length < 7) { toast.error("Geçerli bir numara yok"); return; }
                const { error } = await supabase.from("aramalar").insert({
                  firma_id: firmaId,
                  musteri_telefon: tel,
                  musteri_adi: kisi.ad || null,
                  durum: "aranıyor",
                  satis_durumu: null,
                });
                if (error) { toast.error("Arama başlatılamadı: " + error.message); return; }
                toast.success("Arama başlatıldı: " + tel);
                await onYenile();
              }}
            >
              Arasın
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mesaj at — WhatsApp panelinde manuel yeni-konuşma yok, /whatsapp'a yönlendir */}
      <AlertDialog open={mesajAcik} onOpenChange={setMesajAcik}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>WhatsApp mesajı</AlertDialogTitle>
            <AlertDialogDescription>
              Yeni konuşma başlatma WhatsApp sayfasından yapılıyor. Oraya gidelim mi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setMesajAcik(false);
                void navigate({ to: "/whatsapp" });
              }}
            >
              WhatsApp'a git
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ============================================================
   Randevu ver dialog
   ============================================================ */

export function RandevuVerDialog({
  acik, onClose, firmaId, kisi, baslangicTarih, onKaydedildi,
}: {
  acik: boolean;
  onClose: () => void;
  firmaId: string;
  kisi: Kisi;
  baslangicTarih: string;
  onKaydedildi: () => void | Promise<void>;
}) {
  const [tarih, setTarih] = useState(baslangicTarih);
  const [hizmetId, setHizmetId] = useState<string>("");
  const [notlar, setNotlar] = useState("");
  const [hizmetler, setHizmetler] = useState<Hizmet[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTarih(baslangicTarih); }, [baslangicTarih]);

  useEffect(() => {
    if (!acik || !firmaId) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("hizmetler")
        .select("id, hizmet_adi").eq("firma_id", firmaId).order("hizmet_adi");
      if (!iptal) setHizmetler((data as Hizmet[] | null) ?? []);
    })();
    return () => { iptal = true; };
  }, [acik, firmaId]);

  async function kaydet() {
    if (busy) return;
    if (!tarih) { toast.error("Tarih ve saat seçin"); return; }
    const iso = new Date(tarih).toISOString();
    if (new Date(iso).getTime() < Date.now() - 60_000) {
      toast.error("Randevu tarihi geçmişte olamaz");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("randevular").insert({
        firma_id: firmaId,
        musteri_adi: kisi.ad || null,
        musteri_telefon: (kisi.telefon ?? "").trim() || null,
        tarih_saat: iso,
        sure_dakika: 30,
        konu: null,
        durum: "beklemede",
        notlar: notlar.trim() || null,
        calisan_id: null,
        hizmet_id: hizmetId || null,
        varlik_id: null,
        alinan_tutar: null,
      });
      if (error) { toast.error("Kaydedilemedi: " + error.message); return; }
      toast.success("Randevu eklendi.");
      await onKaydedildi();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={acik} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Randevu ver</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          <KilitAlan et="Müşteri" v={kisi.ad} />
          <KilitAlan et="Telefon" v={kisi.telefon ?? "—"} />
          <div>
            <label className="text-xs font-medium text-slate-600">Tarih ve saat</label>
            <input
              type="datetime-local"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
              style={{ borderColor: "rgba(15,23,42,0.15)" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Hizmet (opsiyonel)</label>
            <select
              value={hizmetId}
              onChange={(e) => setHizmetId(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-white outline-none focus:ring-2"
              style={{ borderColor: "rgba(15,23,42,0.15)" }}
            >
              <option value="">— Seçim yok —</option>
              {hizmetler.map((h) => (
                <option key={h.id} value={h.id}>{h.hizmet_adi ?? "—"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Not (opsiyonel)</label>
            <input
              type="text"
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
              style={{ borderColor: "rgba(15,23,42,0.15)" }}
            />
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose}
            className="h-9 px-3 text-sm rounded-lg border" style={{ borderColor: "rgba(15,23,42,0.15)" }}>
            Vazgeç
          </button>
          <button type="button" onClick={() => void kaydet()}
            disabled={busy}
            className="h-9 px-3 text-sm rounded-lg font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-70"
            style={{ background: LACIVERT }}>
            {busy && <Loader2 size={13} className="animate-spin" />}
            Kaydet
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Sipariş gir dialog
   ============================================================ */

export function SiparisGirDialog({
  acik, onClose, firmaId, kisi, sonAdres, onKaydedildi,
}: {
  acik: boolean;
  onClose: () => void;
  firmaId: string;
  kisi: Kisi;
  sonAdres: { adres: string | null; il: string | null; ilce: string | null } | null;
  onKaydedildi: () => void | Promise<void>;
}) {
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [urunId, setUrunId] = useState<string>("");
  const [adet, setAdet] = useState<number>(1);
  const [tutarStr, setTutarStr] = useState<string>("");
  const [odeme, setOdeme] = useState<string>("pesin");
  const [adres, setAdres] = useState<string>(sonAdres?.adres ?? "");
  const [il, setIl] = useState<string>(sonAdres?.il ?? "");
  const [ilce, setIlce] = useState<string>(sonAdres?.ilce ?? "");
  const [notlar, setNotlar] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [tutarDokunuldu, setTutarDokunuldu] = useState(false);

  useEffect(() => {
    if (!acik || !firmaId) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("urunler")
        .select("id, ad, fiyat").eq("firma_id", firmaId).eq("aktif", true).order("ad");
      if (!iptal) setUrunler((data as Urun[] | null) ?? []);
    })();
    return () => { iptal = true; };
  }, [acik, firmaId]);

  const secili = useMemo(() => urunler.find((u) => u.id === urunId) ?? null, [urunler, urunId]);
  const otoTutar = useMemo(() => {
    if (!secili) return 0;
    return Number(secili.fiyat ?? 0) * (Number(adet) || 0);
  }, [secili, adet]);

  useEffect(() => {
    if (!tutarDokunuldu) setTutarStr(String(otoTutar || ""));
  }, [otoTutar, tutarDokunuldu]);

  async function kaydet() {
    if (busy) return;
    if (!urunId) { toast.error("Bir ürün seçin"); return; }
    if (!Number.isFinite(adet) || adet <= 0) { toast.error("Adet 1 veya daha büyük olmalı"); return; }
    setBusy(true);
    try {
      // Ana motor: fn_satis_ekle_coklu — siparisler.tsx ile birebir aynı
      const { data, error } = await supabase.rpc("fn_satis_ekle_coklu" as never, {
        p_firma_id: firmaId,
        p_musteri_adi: kisi.ad || null,
        p_musteri_telefon: (kisi.telefon ?? "").trim() || null,
        p_odeme_turu: odeme,
        p_durum: "onaylandi",
        p_kalemler: [{ urun_id: urunId, adet }],
        p_adres: adres.trim() || null,
        p_il: il.trim() || null,
        p_ilce: ilce.trim() || null,
        p_notlar: notlar.trim() || null,
      } as never);
      const res = data as { ok?: boolean; hata?: string } | null;
      if (error || !res?.ok) {
        toast.error("Sipariş eklenemedi: " + (error?.message || res?.hata || "bilinmeyen"));
        return;
      }
      // İstenirse tutar override — RPC'nin döndürdüğü satisi güncelle
      const tutarN = Number(tutarStr);
      if (tutarDokunuldu && Number.isFinite(tutarN) && tutarN > 0 && Math.abs(tutarN - otoTutar) > 0.01) {
        // Son eklenen satisi bul (aynı müşteri, aynı ürün, en yeni)
        const { data: son } = await supabase.from("satislar")
          .select("id").eq("firma_id", firmaId).eq("urun_id", urunId)
          .order("olusturuldu_at", { ascending: false }).limit(1);
        const sid = (son as { id: string }[] | null)?.[0]?.id;
        if (sid) await supabase.from("satislar").update({ tutar: tutarN }).eq("id", sid);
      }
      toast.success("Sipariş eklendi.");
      await onKaydedildi();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={acik} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sipariş gir</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KilitAlan et="Müşteri" v={kisi.ad} />
            <KilitAlan et="Telefon" v={kisi.telefon ?? "—"} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Ürün</label>
            <select
              value={urunId}
              onChange={(e) => { setUrunId(e.target.value); setTutarDokunuldu(false); }}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-white outline-none focus:ring-2"
              style={{ borderColor: "rgba(15,23,42,0.15)" }}
            >
              <option value="">— Ürün seç —</option>
              {urunler.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ad ?? "—"}{u.fiyat != null ? ` · ${fmtTL(Number(u.fiyat))}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Adet</label>
              <input
                type="number" min={1} step={1}
                value={adet}
                onChange={(e) => { setAdet(Number(e.target.value) || 0); setTutarDokunuldu(false); }}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                style={{ borderColor: "rgba(15,23,42,0.15)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Tutar (₺)</label>
              <input
                type="number" min={0} step="0.01" inputMode="decimal"
                value={tutarStr}
                onChange={(e) => { setTutarStr(e.target.value); setTutarDokunuldu(true); }}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                style={{ borderColor: "rgba(15,23,42,0.15)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Ödeme</label>
              <select
                value={odeme}
                onChange={(e) => setOdeme(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-white outline-none focus:ring-2"
                style={{ borderColor: "rgba(15,23,42,0.15)" }}
              >
                <option value="pesin">Peşin</option>
                <option value="kapida_odeme">Kapıda Ödeme</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">İl</label>
              <input
                type="text" value={il} onChange={(e) => setIl(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                style={{ borderColor: "rgba(15,23,42,0.15)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">İlçe</label>
              <input
                type="text" value={ilce} onChange={(e) => setIlce(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                style={{ borderColor: "rgba(15,23,42,0.15)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Teslimat notu</label>
              <input
                type="text"
                value={notlar}
                onChange={(e) => setNotlar(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                style={{ borderColor: "rgba(15,23,42,0.15)" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Adres</label>
            <input
              type="text"
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
              style={{ borderColor: "rgba(15,23,42,0.15)" }}
            />
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={onClose}
            className="h-9 px-3 text-sm rounded-lg border" style={{ borderColor: "rgba(15,23,42,0.15)" }}>
            Vazgeç
          </button>
          <button type="button" onClick={() => void kaydet()}
            disabled={busy}
            className="h-9 px-3 text-sm rounded-lg font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-70"
            style={{ background: LACIVERT }}>
            {busy && <Loader2 size={13} className="animate-spin" />}
            Kaydet
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KilitAlan({ et, v }: { et: string; v: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{et}</label>
      <div
        className="mt-1 w-full px-3 py-2 text-sm rounded-lg"
        style={{ background: "rgba(25,54,95,0.05)", color: LACIVERT, border: "1px solid rgba(15,23,42,0.10)" }}
      >
        {v}
      </div>
    </div>
  );
}

/* ============================================================
   Mini Takvim — kişinin tüm randevuları
   ============================================================ */

type TumRandevu = {
  id: string;
  tarih_saat: string | null;
  durum: string | null;
  hizmet_id: string | null;
};

export function MusteriMiniTakvim({
  kisi,
  firmaId,
  hizmetMap,
  onRandevuVer,
  yenile,
}: {
  kisi: Kisi;
  firmaId: string;
  hizmetMap: Map<string, string>;
  onRandevuVer: (tarih: Date) => void;
  /** dışarıdan tetiklenen yenileme (parent yukle()) sonrası bu bileşen kendi verisini de tazelesin */
  yenile: number;
}) {
  const [rows, setRows] = useState<TumRandevu[]>([]);
  const [ay, setAy] = useState<Date>(() => new Date());
  const [secilenGun, setSecilenGun] = useState<Date | undefined>(undefined);

  const son10 = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "").slice(-10);
  const tel10 = son10(kisi.telefon);

  useEffect(() => {
    if (!firmaId || !tel10) { setRows([]); return; }
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("randevular")
        .select("id, tarih_saat, durum, hizmet_id, musteri_telefon")
        .eq("firma_id", firmaId)
        .order("tarih_saat", { ascending: false })
        .limit(500);
      if (iptal) return;
      const tum = ((data as (TumRandevu & { musteri_telefon: string | null })[] | null) ?? [])
        .filter((r) => son10(r.musteri_telefon) === tel10);
      setRows(tum);
    })();
    return () => { iptal = true; };
  }, [firmaId, tel10, yenile]);

  const gunSet = useMemo(() => {
    const s = new Map<string, TumRandevu[]>();
    for (const r of rows) {
      if (!r.tarih_saat) continue;
      const d = new Date(r.tarih_saat);
      const key = ymd(d);
      const arr = s.get(key) ?? [];
      arr.push(r);
      s.set(key, arr);
    }
    return s;
  }, [rows]);

  const isaretliGunler = useMemo(() => {
    return Array.from(gunSet.keys()).map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  }, [gunSet]);

  const secilenKey = secilenGun ? ymd(secilenGun) : "";
  const gununRandevulari = secilenKey ? (gunSet.get(secilenKey) ?? []) : [];

  const gunEt = secilenGun
    ? secilenGun.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  const yil = ay.getFullYear();
  const aySira = ay.getMonth();
  const ilkGun = (new Date(yil, aySira, 1).getDay() + 6) % 7;
  const gunSayisi = new Date(yil, aySira + 1, 0).getDate();
  const bugun = new Date();
  const ayEt = ay.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  const haftaGun = ["Pt", "Sa", "\u00c7a", "Pe", "Cu", "Ct", "Pz"];
  const hucreler: (Date | null)[] = [];
  for (let i = 0; i < ilkGun; i++) hucreler.push(null);
  for (let d = 1; d <= gunSayisi; d++) hucreler.push(new Date(yil, aySira, d));

  return (
    <div style={{ background: "#fff", border: "1px solid #e6eaf1", borderRadius: 16, padding: 16, boxShadow: "0 1px 2px rgba(15,27,46,.04), 0 12px 30px rgba(15,27,46,.06)" }}>
      <style>{`.mw1a-day{transition:transform .14s ease, box-shadow .14s ease}.mw1a-day:hover{transform:translateY(-2px);box-shadow:0 6px 14px rgba(15,27,46,.12)}`}</style>
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
        <div style={{ background: "linear-gradient(180deg,#fcfdff,#f6f8fc)", border: "1px solid #eef1f7", borderRadius: 14, padding: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <button type="button" aria-label="Önceki ay" onClick={() => setAy(new Date(yil, aySira - 1, 1))}
              className="grid place-items-center" style={{ width: 36, height: 36, borderRadius: 11, border: "1px solid #e6eaf1", background: "#fff", color: LACIVERT, cursor: "pointer", fontSize: 18, fontWeight: 700, boxShadow: "0 2px 6px rgba(15,27,46,.05)" }}>&lsaquo;</button>
            <div className="capitalize" style={{ fontSize: 16, fontWeight: 800, color: "#0f1b2e" }}>{ayEt}</div>
            <button type="button" aria-label="Sonraki ay" onClick={() => setAy(new Date(yil, aySira + 1, 1))}
              className="grid place-items-center" style={{ width: 36, height: 36, borderRadius: 11, border: "1px solid #e6eaf1", background: "#fff", color: LACIVERT, cursor: "pointer", fontSize: 18, fontWeight: 700, boxShadow: "0 2px 6px rgba(15,27,46,.05)" }}>&rsaquo;</button>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 7, marginBottom: 6 }}>
            {haftaGun.map((g, gi) => (
              <div key={g} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: gi >= 5 ? "#a2557a" : "#66708a" }}>{g}</div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 7 }}>
            {hucreler.map((d, i) => {
              if (!d) return <div key={"b" + i} />;
              const key = ymd(d);
              const rvSayi = gunSet.get(key)?.length ?? 0;
              const secili = secilenGun ? ymd(secilenGun) === key : false;
              const buGun = ymd(d) === ymd(bugun);
              const haftaSonu = d.getDay() === 0 || d.getDay() === 6;
              return (
                <button key={key} type="button" onClick={() => setSecilenGun(d)}
                  className="mw1a-day flex flex-col items-center justify-center"
                  style={{
                    aspectRatio: "1", borderRadius: 12, fontSize: 13.5, fontWeight: secili || buGun ? 800 : 600, cursor: "pointer", position: "relative",
                    border: secili ? "1px solid transparent" : buGun ? `1.5px solid ${LACIVERT}` : "1px solid #eef1f7",
                    background: secili ? "linear-gradient(160deg,#19365F,#2b5288)" : haftaSonu ? "#f7f9fc" : "#fff",
                    color: secili ? "#fff" : buGun ? LACIVERT : "#0f1b2e",
                    boxShadow: secili ? "0 8px 18px rgba(25,54,95,.35)" : "0 1px 2px rgba(15,27,46,.03)",
                  }}>
                  {d.getDate()}
                  {rvSayi > 0 && (
                    <span style={{ position: "absolute", top: 4, right: 5, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 20, background: secili ? "#fff" : LACIVERT, color: secili ? LACIVERT : "#fff", fontSize: 9, fontWeight: 800, display: "grid", placeItems: "center" }}>{rvSayi}</span>
                  )}
                  {rvSayi > 0 && (
                    <span style={{ position: "absolute", bottom: 5, display: "flex", gap: 2.5 }}>
                      {Array.from({ length: Math.min(rvSayi, 3) }).map((_, di) => (
                        <span key={di} style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: secili ? "#fff" : "#15803d" }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "#66708a", marginBottom: 12 }}>
            {secilenGun ? secilenGun.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", weekday: "long" }) : "Bir gün seçin"}
          </div>
          {!secilenGun ? (
            <div style={{ fontSize: 13, color: "#66708a" }}>Takvimden bir güne dokunun; o günün randevularını görün veya yeni randevu ekleyin.</div>
          ) : (
            <div className="flex flex-col" style={{ gap: 9 }}>
              {gununRandevulari
                .sort((a, b) => (a.tarih_saat ?? "").localeCompare(b.tarih_saat ?? ""))
                .map((r) => {
                  const rz = rvRozet(r.durum);
                  return (
                    <div key={r.id} className="flex items-center" style={{ gap: 11, border: "1px solid #e6eaf1", borderRadius: 13, padding: "11px 13px", background: "#fff", boxShadow: "0 1px 2px rgba(15,27,46,.03), 0 5px 12px rgba(15,27,46,.05)" }}>
                      <span style={{ fontWeight: 800, color: LACIVERT, fontSize: 15, minWidth: 52 }}>{fmtSaat(r.tarih_saat)}</span>
                      <div className="flex-1 min-w-0 truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {r.hizmet_id ? (hizmetMap.get(r.hizmet_id) ?? "Hizmet") : "Randevu"}
                      </div>
                      <span className="shrink-0" style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: rz.bg, color: rz.fg }}>{rz.et}</span>
                    </div>
                  );
                })}
              <button type="button" onClick={() => onRandevuVer(secilenGun)}
                className="w-full flex items-center justify-center active:scale-[.98]"
                style={{ gap: 7, padding: 13, border: `1.5px dashed ${LACIVERT}`, borderRadius: 13, background: "rgba(25,54,95,0.05)", color: LACIVERT, fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "background .15s" }}>
                + Bu güne randevu ver
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function rvRozet(d: string | null): { et: string; bg: string; fg: string } {
  const k = (d ?? "").toLowerCase();
  if (k === "tamamlandi") return { et: "Tamamlandı", bg: "rgba(22,163,74,0.12)", fg: "#15803D" };
  if (k === "iptal") return { et: "İptal", bg: "rgba(100,116,139,0.14)", fg: "#475569" };
  if (k === "onaylandi" || k === "beklemede") return { et: "Yaklaşan", bg: "rgba(37,99,235,0.12)", fg: "#1D4ED8" };
  return { et: d ?? "—", bg: "rgba(100,116,139,0.12)", fg: "#475569" };
}

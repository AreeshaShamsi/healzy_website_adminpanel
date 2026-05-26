import { useState, useCallback, useEffect, useRef } from "react";

//  helpers 
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

//  FIX B: wc guards against non-string input 
const wc = (s) => {
  if (!s || typeof s !== "string") return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
};

//  FIX J + K: hasOneH1 handles \r\n line endings and full H1 tag matching
const hasOneH1 = (s) => {
  if (!s || typeof s !== "string") return false;
  const normalized = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const md = (normalized.match(/^# .+/gm) || []).length;
  const ht = (normalized.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || []).length;
  return md + ht === 1;
};

//  FIX K: countQH2 normalizes line endings 
const countQH2 = (s) => {
  if (!s || typeof s !== "string") return { q: 0, total: 0 };
  const normalized = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const all = normalized.match(/^## .+/gm) || [];
  const q = all.filter((h) => /\?$/.test(h.trim())).length;
  return { q, total: all.length };
};

//  FIX A + M: Safe keyword density using escaped regex 
const computeKeywordDensity = (content, keyword) => {
  if (!keyword || !content || typeof content !== "string") return 0;
  const words = wc(content);
  if (words === 0) return 0;
  try {
    const matches = (
      content.toLowerCase().match(new RegExp(escapeRegex(keyword.toLowerCase()), "g")) || []
    ).length;
    return (matches / words) * 100;
  } catch {
    return 0;
  }
};

//  FAQ content validation 
const faqsAreValid = (faqs) =>
  Array.isArray(faqs) &&
  faqs.length >= 4 &&
  faqs.every((f) => f.q && f.q.trim().length > 0 && f.a && f.a.trim().length > 0);

const SEO_CHECKS = [
  { key: "meta-title-len", label: "Meta title 5060 chars", pts: 10 },
  { key: "meta-desc-len",  label: "Meta desc 140155 chars", pts: 10 },
  { key: "kw-in-title",   label: "Focus keyword in meta title", pts: 10 },
  { key: "kw-first-100",  label: "Keyword in first 100 words", pts: 10 },
  { key: "kw-density",    label: "Keyword density 12%", pts: 10 },
  { key: "word-count",    label: "Min word count met (1200)", pts: 10 },
  { key: "cover-img",     label: "Cover image with alt text", pts: 10 },
  { key: "aeo-block",     label: "Answer block 4060 words", pts: 10 },
  { key: "faq-min",       label: "Min 4 FAQ pairs", pts: 10 },
  { key: "llm-pop",       label: "Summary 300 chars", pts: 10 },
];

const AUTHORS_API_URL = import.meta.env.VITE_API_AUTHORS_URL;
const BLOG_API_URL = import.meta.env.VITE_API_BLOG_URL;
const BLOG_CREATE_URL =
  BLOG_API_URL || "http://localhost:5000/api/blog";

const extractAuthors = (payload) => {
  const root = Array.isArray(payload)
    ? payload
    : payload?.data || payload?.blogs || payload?.authors || [];

  if (!Array.isArray(root)) return [];

  const mapped = root
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const rawAuthor = item.author && typeof item.author === "object" ? item.author : item;
      const id = rawAuthor._id || rawAuthor.id || rawAuthor.authorId || `${rawAuthor.name || "author"}-${index}`;
      const name = rawAuthor.name || rawAuthor.authorName || rawAuthor.fullName || "";
      if (!name) return null;
      return { id: String(id), name };
    })
    .filter(Boolean);

  const seen = new Set();
  return mapped.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
};

//  sub-components 

function CharBar({ current, min, max, unit = "chars" }) {
  const pct = Math.min((current / Math.max(max, 1)) * 100, 100);
  const ok = current >= (min || 0) && current <= max;
  const color = current === 0 ? "#b4b2a9" : ok ? "#1d9e75" : "#e24b4a";
  const labelColor = current === 0 ? "text-gray-400" : ok ? "text-emerald-700" : "text-red-600";
  const label =
    unit === "words"
      ? `${current} words (need ${min || 0}${max === 99999 ? "" : max})`
      : `${current} / ${max} chars${min ? ` (min ${min})` : ""}`;
  return (
    <div className="mt-1">
      <div className="h-[3px] bg-gray-200 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all duration-200" />
      </div>
      <p className={`text-[11px] mt-1 ${labelColor}`}>{label}</p>
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-medium tracking-widest uppercase text-gray-500 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Hint({ children }) {
  return <p className="text-[11px] text-gray-400 mb-1.5">{children}</p>;
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-5 lg:p-6 mb-4 ${className}`}>
      {children}
    </div>
  );
}

function CardHead({ title, badge }) {
  return (
    <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-gray-100">
      <h3 className="text-[11px] font-medium tracking-widest uppercase text-gray-500">{title}</h3>
      {badge}
    </div>
  );
}

function Badge({ variant = "warn", children }) {
  const cls = {
    ok:   "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
    red:  "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-800",
  }[variant] || "bg-amber-50 text-amber-800";
  return <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${cls}`}>{children}</span>;
}

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div className={`w-9 h-5 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-gray-300"}`}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
    </label>
  );
}

function GroupPanel({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-2 overflow-hidden">
      <div
        onClick={() => setOpen((o) => !o)}
        className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer ${open ? "border-b border-gray-100" : ""}`}
      >
        <h4 className="text-[11px] font-medium tracking-widest uppercase text-gray-500">{title}</h4>
        <span className={`text-gray-400 text-sm transition-transform ${open ? "rotate-90" : ""}`}></span>
      </div>
      {open && <div className="px-3.5 py-3">{children}</div>}
    </div>
  );
}

function TagPill({ label, onRemove, variant = "default" }) {
  const cls = variant === "entity"
    ? "bg-blue-50 text-blue-800 border-blue-200"
    : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full border ${cls}`}>
      {label}
      {onRemove && (
        <button onClick={onRemove} className="text-gray-400 hover:text-gray-600 leading-none text-sm">&times;</button>
      )}
    </span>
  );
}

//  EDITOR 
function EditorView() {
  const contentEditorRef = useRef(null);
  const [topic, setTopic] = useState("");
  const [primaryKw, setPrimaryKw] = useState("");
  const [secKws, setSecKws] = useState([]);
  const [secKwInput, setSecKwInput] = useState("");
  const [industry, setIndustry] = useState("Hospital");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [canonical, setCanonical] = useState("");
  const [content, setContent] = useState("");
  const [aeo, setAeo] = useState("");
  const [summary, setSummary] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [faqs, setFaqs] = useState([
    { q: "", a: "" },
    { q: "", a: "" },
    { q: "", a: "" },
    { q: "", a: "" },
  ]);
  const [intLinks, setIntLinks] = useState(["", "", ""]);
  const [extLinks, setExtLinks] = useState([{ url: "", rel: "nofollow" }]);
  const [entities, setEntities] = useState([]);
  const [entityInput, setEntityInput] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("");
  const [author, setAuthor] = useState("");
  const [authorOptions, setAuthorOptions] = useState([]);
  const [isAuthorsLoading, setIsAuthorsLoading] = useState(false);
  const [authorsError, setAuthorsError] = useState("");
  const [status, setStatus] = useState("draft");
  const [pubDate, setPubDate] = useState("");
  const [noIndex, setNoIndex] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState(null);

  useEffect(() => {
    let ignore = false;

    const loadAuthors = async () => {
      try {
        setIsAuthorsLoading(true);
        setAuthorsError("");
        const tryUrls = [AUTHORS_API_URL, BLOG_API_URL];
        let list = [];

        for (const url of tryUrls) {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          list = extractAuthors(data);
          if (list.length > 0) break;
        }

        if (!ignore) setAuthorOptions(list);
      } catch (error) {
        if (!ignore) {
          setAuthorOptions([]);
          setAuthorsError("Failed to load authors");
        }
        console.error("Failed to fetch authors from blog API:", error);
      } finally {
        if (!ignore) setIsAuthorsLoading(false);
      }
    };

    loadAuthors();
    return () => {
      ignore = true;
    };
  }, []);

  const addSecKw = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const v = secKwInput.replace(",", "").trim();
      if (!v || secKws.includes(v)) {
        setSecKwInput("");
        return;
      }
      setSecKws((prev) => [...prev, v]);
      setSecKwInput("");
    }
  };

  const applyContentFormat = (type) => {
    const textarea = contentEditorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selectedText = content.slice(start, end);
    let nextText = content;
    let nextSelectionStart = start;
    let nextSelectionEnd = end;

    if (type === "bold") {
      const inserted = `**${selectedText}**`;
      nextText = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
      nextSelectionStart = start + 2;
      nextSelectionEnd = start + 2 + selectedText.length;
    } else if (type === "italic") {
      const inserted = `*${selectedText}*`;
      nextText = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
      nextSelectionStart = start + 1;
      nextSelectionEnd = start + 1 + selectedText.length;
    } else if (type === "underline") {
      const inserted = `<u>${selectedText}</u>`;
      nextText = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
      nextSelectionStart = start + 3;
      nextSelectionEnd = start + 3 + selectedText.length;
    } else if (type === "h1") {
      const inserted = "# ";
      nextText = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
      nextSelectionStart = start + inserted.length;
      nextSelectionEnd = start + inserted.length;
    } else if (type === "h2") {
      const inserted = "## ";
      nextText = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
      nextSelectionStart = start + inserted.length;
      nextSelectionEnd = start + inserted.length;
    }

    setContent(nextText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    }, 0);
  };

  const computeSeoChecks = useCallback(() => {
    const kw = primaryKw.toLowerCase();
    const mt = metaTitle;
    const md = metaDesc;
    const cw = wc(content);
    const aeoW = wc(aeo);
    const summaryLen = summary.length;

    const first100 = content.split(/\s+/).slice(0, 100).join(" ").toLowerCase();
    const density = computeKeywordDensity(content, primaryKw);

    return {
      "meta-title-len": mt.length >= 50 && mt.length <= 60,
      "meta-desc-len":  md.length >= 140 && md.length <= 155,
      "kw-in-title":    !!(kw && mt.toLowerCase().includes(kw)),
      "kw-first-100":   !!(kw && first100.includes(kw)),
      "kw-density":     density >= 1 && density <= 2,
      "word-count":     cw >= 1200,
      "cover-img":      !!(imgUrl && altText),
      "aeo-block":      aeoW >= 40 && aeoW <= 60,
      // FIX I: validate FAQ content, not just count
      "faq-min":        faqsAreValid(faqs),
      "llm-pop":        summaryLen > 0 && summaryLen <= 300,
    };
  }, [primaryKw, metaTitle, metaDesc, content, aeo, summary, imgUrl, altText, faqs]);

  const seoResults = computeSeoChecks();
  const score = Object.values(seoResults).filter(Boolean).length * 10;

  const cw = wc(content);
  const aeoW = wc(aeo);
  const summaryLen = summary.length;
  const summarySents = summary.split(/[.!?]+/).filter((s) => s.trim()).length;
  const h2data = countQH2(content);
  const altBad = /img of|image of|picture of/i.test(altText);
  const intOk = intLinks.filter(Boolean).length >= 3;
  const mtEndsOk = metaTitle.endsWith("| Healzy");

  // FIX I: allValid uses faqsAreValid
  const allValid =
    title.length >= 50 && title.length <= 65 &&
    /^[a-z0-9-]+$/.test(slug) && slug.length <= 60 && slug.length > 0 &&
    metaTitle.length >= 50 && metaTitle.length <= 60 && mtEndsOk &&
    metaDesc.length >= 140 && metaDesc.length <= 155 &&
    cw >= 1200 && hasOneH1(content) &&
    aeoW >= 40 && aeoW <= 60 &&
    faqsAreValid(faqs) &&
    summaryLen > 0 && summaryLen <= 300 && summarySents <= 3 &&
    !!imgUrl && altText.length > 0 && altText.length <= 125 && !altBad &&
    intOk;

  const canPublish =
    score >= 90 &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    metaTitle.trim().length > 0;

  useEffect(() => {
    console.log("[Publish State]", {
      score,
      canPublish,
      isSubmitting,
      allValid,
      required: {
        title: !!title.trim(),
        content: !!content.trim(),
        metaTitle: !!metaTitle.trim(),
      },
    });
  }, [score, canPublish, isSubmitting, allValid, title, content, metaTitle]);

  // FIX A + M: density display uses escapeRegex via computeKeywordDensity
  let densityText  = "Set primary keyword and add content to see density";
  let densityColor = "text-gray-400";
  if (primaryKw && cw > 0) {
    const d = computeKeywordDensity(content, primaryKw);
    const matches = d > 0 ? Math.round((d / 100) * cw) : 0;
    const dStr = d.toFixed(2);
    densityText  = `${dStr}% density (${matches} occurrences / ${cw} words) ${d >= 1 && d <= 2 ? "" : ""}`;
    densityColor = d >= 1 && d <= 2 ? "text-emerald-700" : "text-red-600";
  }

  const handleSave = async (s) => {
    console.log("[Blog Submit] Triggered", { status: s });
    console.log("[Blog Submit] API FUNCTION CALLED", { url: BLOG_CREATE_URL });
    if (s === "published" && !canPublish) {
      alert("Please complete required publish fields and keep SEO score at 90+.");
      return;
    }

    if (!coverImageFile) {
      alert("Cover image file is required.");
      return;
    }

    if (!author) {
      alert("Please select an author.");
      return;
    }

    const cleanedFaqs = faqs
      .filter((f) => f.q.trim() && f.a.trim())
      .map((f) => ({
        question: f.q.trim(),
        answer: f.a.trim(),
      }));

    const cleanedInternalLinks = intLinks.filter((l) => l.trim());

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("slug", slug.trim());
    formData.append("meta_title", metaTitle.trim());
    formData.append("meta_description", metaDesc.trim());
    formData.append("primary_keyword", primaryKw.trim());
    formData.append("secondary_keywords", JSON.stringify(secKws));
    formData.append("author_id", author);
    formData.append("content_mdx", content);
    formData.append("answer_block", aeo);
    formData.append("faq_json", JSON.stringify(cleanedFaqs));
    formData.append("internal_links", JSON.stringify(cleanedInternalLinks));
    formData.append("content_summary", summary.trim());
    formData.append("entities", JSON.stringify(entities));
    formData.append("cover_image_alt", altText.trim());
    formData.append("status", s);
    if (pubDate) {
      formData.append("published_at", new Date(pubDate).toISOString());
    }
    formData.append("cover_image", coverImageFile);

    console.log("[Blog Submit] FormData entries:");
    for (const [key, value] of formData.entries()) {
      console.log(" -", key, value instanceof File ? `File(${value.name}, ${value.type}, ${value.size})` : value);
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(BLOG_CREATE_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("[Blog Submit] API response", {
        status: response.status,
        ok: response.ok,
        data,
      });

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save blog");
      }

      const msg = `Saved as ${s} at ${new Date().toLocaleTimeString()}`;
      setSaveMsg(msg);
      alert(`Blog saved as "${s}"!\nAll checks passed`);
    } catch (error) {
      console.error("[Blog Submit] Error", error);
      alert(error.message || "Failed to save blog");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e, statusToSave) => {
    e.preventDefault();
    console.log("[Blog Submit] SUBMIT CLICKED", { status: statusToSave });
    await handleSave(statusToSave);
  };

  const scoreCircleColor = score >= 80 ? "bg-emerald-50 text-emerald-800" : score >= 60 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700";
  const globalBadge = allValid ? { v: "ok", t: " All valid" } : score >= 60 ? { v: "warn", t: " Some issues" } : { v: "red", t: "- Needs work" };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-3 sm:px-4 md:px-6 lg:px-10 xl:px-12 2xl:px-16 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[15px] font-medium text-gray-800">
          <svg width="16" height="16" fill="none" stroke="#1d9e75" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Blog Editor
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant={globalBadge.v}>{globalBadge.t}</Badge>
        </div>
      </div>

      <div className="w-full max-w-none mx-auto px-3 sm:px-4 md:px-6 lg:px-10 xl:px-12 2xl:px-16 py-4 sm:py-6">
        <div className="mb-4">
          <h2 className="text-xl font-medium text-gray-900">Create or edit blog</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Write and publish manually - no AI generation.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px] gap-3 lg:gap-4 items-start">
          {/* LEFT */}
          <div className="min-w-0">
            {/* SEO Score */}
            <Card>
              <CardHead title="SEO score" />
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-medium flex-none ${scoreCircleColor}`}>{score}</div>
                <div>
                  <p className="font-medium text-[14px] text-gray-900">Score: {score} / 100</p>
                  <p className="text-[12px] text-gray-500">{score >= 80 ? "Great! Ready to publish." : score >= 60 ? "Publish with caution  some issues." : "Fix issues before publishing."}</p>
                  
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SEO_CHECKS.map((c) => (
                  <div key={c.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5 text-[11px]">
                    <span className="text-gray-600">{c.label}</span>
                    <span className={`font-medium ${seoResults[c.key] ? "text-emerald-700" : "text-red-600"}`}>{seoResults[c.key] ? "+" : ""}{c.pts}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* SEO Basics */}
            <Card>
              <CardHead title="SEO basics" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                {/* H1 Title */}
                <div className="mb-0 lg:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel required>H1 title</FieldLabel>
</div>
                  <Hint>5065 chars  primary keyword in first 5 words  question or benefit statement</Hint>
                  <input className={`w-full border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 ${title && (title.length < 50 || title.length > 65) ? "border-red-400" : "border-gray-200"}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How LEED-Certified Hospitals Improve Patient Recovery Rates" />
                  <CharBar current={title.length} min={50} max={65} />
                </div>
                {/* Slug */}
                <div className="mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel required>Slug</FieldLabel>
</div>
                  <Hint>Lowercase, hyphens only  max 60 chars</Hint>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                    <span className="text-[12px] text-gray-400 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 whitespace-nowrap">/blog/</span>
                    <input className={`flex-1 border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 ${slug && (!/^[a-z0-9-]+$/.test(slug) || slug.length > 60) ? "border-red-400" : "border-gray-200"}`} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="leed-certified-hospitals-patient-recovery" />
                  </div>
                  <CharBar current={slug.length} min={0} max={60} />
                </div>
                {/* Meta Title */}
                <div className="mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel required>Meta title</FieldLabel>
</div>
                  <Hint>5060 chars  keyword in first 4 words  ends "| Healzy"</Hint>
                  <input className={`w-full border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 ${metaTitle && (metaTitle.length < 50 || metaTitle.length > 60 || !mtEndsOk) ? "border-red-400" : "border-gray-200"}`} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="LEED-Certified Hospitals & Patient Recovery | Healzy" />
                  <CharBar current={metaTitle.length} min={50} max={60} />
                  {metaTitle && !mtEndsOk && <p className="text-[11px] text-red-600 mt-1">Must end with "| Healzy"</p>}
                </div>
                {/* Meta Desc */}
                <div className="mb-0 lg:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel required>Meta description</FieldLabel>
</div>
                  <Hint>140155 chars  includes keyword + outcome + CTA</Hint>
                  <textarea className={`w-full border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 resize-y ${metaDesc && (metaDesc.length < 140 || metaDesc.length > 155) ? "border-red-400" : "border-gray-200"}`} rows={3} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder="Discover how LEED-certified hospital architecture directly impacts patient recovery rates, reducing stay durations and improving outcomes." />
                  <CharBar current={metaDesc.length} min={140} max={155} />
                </div>
                {/* Canonical */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel>Canonical URL</FieldLabel>
                  </div>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500" value={canonical} onChange={(e) => setCanonical(e.target.value)} placeholder="https://healzy.in/blog/your-slug (defaults to self)" />
                </div>
              </div>
            </Card>

            {/* Content */}
            <Card>
              <CardHead
                title="Content (MDX)"
                badge={
                  <Badge variant={cw >= 1200 && hasOneH1(content) ? "ok" : "warn"}>
                    {cw >= 1200 && hasOneH1(content) ? `${cw} words` : "1200+ words"}
                  </Badge>
                }
              />
              <div>
                <FieldLabel required>Blog content</FieldLabel>
                <Hint>Min 1200 words  exactly one H1  logical H2H4 hierarchy</Hint>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button type="button" onClick={() => applyContentFormat("bold")} className="px-2.5 py-1 text-[12px] border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50">Bold</button>
                  <button type="button" onClick={() => applyContentFormat("italic")} className="px-2.5 py-1 text-[12px] border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50">Italic</button>
                  <button type="button" onClick={() => applyContentFormat("underline")} className="px-2.5 py-1 text-[12px] border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50">Underline</button>
                  <button type="button" onClick={() => applyContentFormat("h1")} className="px-2.5 py-1 text-[12px] border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50">H1 (#)</button>
                  <button type="button" onClick={() => applyContentFormat("h2")} className="px-2.5 py-1 text-[12px] border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50">H2 (##)</button>
                </div>
                <textarea ref={contentEditorRef} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-emerald-500 resize-y" rows={14} value={content} onChange={(e) => setContent(e.target.value)} placeholder={"# Your H1 Heading Here\n\nStart writing your blog content in MDX format...\n\n## Section 1\n\nYour content here..."} />
                <CharBar current={cw} min={1200} max={99999} unit="words" />
                {content && !hasOneH1(content) && <p className="text-[11px] text-red-600 mt-1">Content must contain exactly one H1</p>}
                {h2data.total > 0 && <span className="text-[11px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 mt-1.5 inline-block">{h2data.q} of {h2data.total} H2s are question-phrased</span>}
              </div>
            </Card>

            {/* AEO */}
            <Card>
              <CardHead
                title="AEO answer block"
                badge={
                  <Badge variant={aeoW >= 40 && aeoW <= 60 ? "ok" : "warn"}>
                    {aeoW >= 40 && aeoW <= 60 ? `${aeoW} words` : "40-60 words"}
                  </Badge>
                }
              />
              <div>
                <FieldLabel required>Featured answer</FieldLabel>
                <Hint>4060 words  plain language  no jargon  no "In this article"</Hint>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 resize-y" rows={4} value={aeo} onChange={(e) => setAeo(e.target.value)} placeholder="LEED-certified hospitals improve patient recovery by ensuring better air quality, natural lighting, and reduced noise pollution." />
                <CharBar current={aeoW} min={40} max={60} unit="words" />
              </div>
            </Card>

            {/* FAQ */}
            <Card>
              <CardHead
                title="FAQ manager"
                badge={
                  <Badge variant={faqsAreValid(faqs) ? "ok" : "warn"}>
                    {faqs.length} / min 4
                  </Badge>
                }
              />
              {faqs.map((f, i) => {
                const aw = wc(f.a);
                const faqOk = aw >= 40 && aw <= 80;
                const faqPct = Math.min((aw / 80) * 100, 100);
                const faqColor = aw === 0 ? "#b4b2a9" : faqOk ? "#1d9e75" : "#e24b4a";
                return (
                  <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50 mb-2.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-widest">FAQ {i + 1}</span>
                      {faqs.length > 4 && <button onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} className="text-[11px] text-red-600">Remove</button>}
                    </div>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 mb-1.5" placeholder="Question (max 80 chars)" value={f.q} onChange={(e) => setFaqs(faqs.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} />
                    <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 resize-y" rows={3} placeholder="Answer (4080 words)" value={f.a} onChange={(e) => setFaqs(faqs.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
                    <div className="mt-1">
                      <div className="h-[3px] bg-gray-200 rounded-full overflow-hidden">
                        <div style={{ width: `${faqPct}%`, background: faqColor }} className="h-full rounded-full" />
                      </div>
                      <p className={`text-[11px] mt-1 ${aw === 0 ? "text-gray-400" : faqOk ? "text-emerald-700" : "text-red-600"}`}>{aw} words (need 4080)</p>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setFaqs([...faqs, { q: "", a: "" }])} className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                <span className="w-[18px] h-[18px] rounded-full border-2 border-emerald-600 flex items-center justify-center text-sm leading-none">+</span>
                Add FAQ item
              </button>
            </Card>

            {/* LLM Summary */}
            <Card>
              <CardHead title="Short summary" />
              <div>
                <FieldLabel required>Short summary</FieldLabel>
                <Hint>13 sentences  max 300 chars  subject-predicate-object</Hint>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 resize-y" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="LEED-certified hospitals improve patient recovery through better air quality and lighting." />
                <CharBar current={summaryLen} min={0} max={300} />
              </div>
            </Card>

            {/* Cover Image */}
            <Card>
              <CardHead title="Cover image" />
              <div className="mb-4">
                <FieldLabel required>Image URL</FieldLabel>
                <Hint>Min 1200-630px  WebP preferred  &lt;200KB</Hint>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://cdn.healzy.com/images/leed-hospital.webp" />
                {imgUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden h-28 bg-gray-100">
                    {/* FIX D: null-safe onError via optional chaining */}
                    <img
                      src={imgUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        if (e.target?.parentElement) {
                          e.target.parentElement.style.display = "none";
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="mb-4">
                <FieldLabel required>Cover Image File</FieldLabel>
                <Hint>Upload file as multipart field: cover_image</Hint>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500"
                  onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)}
                />
                {coverImageFile ? (
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Selected: {coverImageFile.name}
                  </p>
                ) : null}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel required>Alt text</FieldLabel>
</div>
                <Hint>Max 125 chars  descriptive  includes keyword where natural  no "image of"</Hint>
                <input className={`w-full border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 ${altText && (altBad || altText.length > 125) ? "border-red-400" : "border-gray-200"}`} value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Modern LEED-certified hospital corridor with natural lighting" />
                <CharBar current={altText.length} min={0} max={125} />
                {altText && altBad && <p className="text-[11px] text-red-600 mt-1">Remove phrases like "image of", "picture of"</p>}
              </div>
            </Card>

            {/* Links */}
            <Card>
              <CardHead title="Links" />
              <div className="mb-4">
                <FieldLabel required>Internal links</FieldLabel>
                <Hint>Min 3  at least 1 to service page, 1 to case study, 1 to related blog</Hint>
                {intLinks.map((l, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-1.5 mb-1.5">
                    <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500" placeholder="/blog/related-article" value={l} onChange={(e) => setIntLinks(intLinks.map((x, j) => j === i ? e.target.value : x))} />
                    {intLinks.length > 3 && <button onClick={() => setIntLinks(intLinks.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600 text-xl px-1">&times;</button>}
                  </div>
                ))}
                <button onClick={() => setIntLinks([...intLinks, ""])} className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 mt-1">
                  <span className="w-[18px] h-[18px] rounded-full border-2 border-emerald-600 flex items-center justify-center text-sm leading-none">+</span>
                  Add internal link
                </button>
                {!intOk && <p className="text-[11px] text-red-600 mt-1">At least 3 internal links required</p>}
              </div>
              <div>
                <FieldLabel>External links</FieldLabel>
                <Hint>12 per post  DA &gt;60 sources  rel attribute required</Hint>
                {extLinks.map((l, i) => (
                  <div key={i} className="flex gap-1.5 mb-1.5">
                    <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500" placeholder="https://who.int/reference" value={l.url} onChange={(e) => setExtLinks(extLinks.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                    <select className="border border-gray-200 rounded-lg px-2 py-2 text-[12px] focus:outline-none w-full sm:w-[110px]" value={l.rel} onChange={(e) => setExtLinks(extLinks.map((x, j) => j === i ? { ...x, rel: e.target.value } : x))}>
                      {["nofollow", "noreferrer", "noopener", "sponsored"].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => setExtLinks(extLinks.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600 text-xl px-1 self-end sm:self-auto">&times;</button>
                  </div>
                ))}
                {extLinks.length < 2
                  ? <button onClick={() => setExtLinks([...extLinks, { url: "", rel: "nofollow" }])} className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 mt-1">
                      <span className="w-[18px] h-[18px] rounded-full border-2 border-emerald-600 flex items-center justify-center text-sm leading-none">+</span>
                      Add external link
                    </button>
                  : <p className="text-[11px] text-amber-700 mt-1">Maximum 2 external links reached</p>
                }
              </div>
            </Card>
          </div>

          {/* RIGHT: meta panel */}
          <div className="min-w-0 xl:sticky xl:top-[60px]">
            <GroupPanel title="SEO essentials">
              <div className="mb-3">
                <FieldLabel>Blog topic</FieldLabel>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 mt-1"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Editorial angle for this post"
                />
              </div>
              <div className="mb-3">
                <FieldLabel>Primary keyword</FieldLabel>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 mt-1"
                  value={primaryKw}
                  onChange={(e) => setPrimaryKw(e.target.value)}
                  placeholder="focus keyword"
                />
              </div>
              <div className="mb-3">
                <FieldLabel>Category</FieldLabel>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select category</option>
                  {["Hospital Marketing","Healthcare Technology","Digital Advertising","Patient Acquisition"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <FieldLabel>Tags</FieldLabel>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 mt-1"
                  placeholder="Type tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const v = tagInput.replace(",", "").trim();
                      // FIX R: no duplicate tags
                      if (!v || tags.includes(v)) { setTagInput(""); return; }
                      setTags([...tags, v]);
                      setTagInput("");
                    }
                  }}
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">{tags.map((t, i) => <TagPill key={i} label={t} onRemove={() => setTags(tags.filter((_, j) => j !== i))} />)}</div>
              </div>
              <div className="mb-3">
                <FieldLabel>Focus keyword density</FieldLabel>
                <div className={`text-[12px] px-2.5 py-1.5 bg-gray-50 rounded-lg mt-1 ${densityColor}`}>{densityText}</div>
              </div>
              <div className="mb-3">
                <FieldLabel>Secondary keywords</FieldLabel>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500 mt-1"
                  placeholder="Press Enter to add"
                  value={secKwInput}
                  onChange={(e) => setSecKwInput(e.target.value)}
                  onKeyDown={addSecKw}
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {secKws.map((t, i) => (
                    <TagPill key={i} label={t} onRemove={() => setSecKws(secKws.filter((_, j) => j !== i))} />
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Industry</FieldLabel>
                <div className="flex gap-4 mt-1.5">
                  {["Hospital"].map((v) => (
                    <label key={v} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                      <input type="radio" name="editor-industry" value={v} checked={industry === v} onChange={() => setIndustry(v)} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
            </GroupPanel>

            <GroupPanel title="AEO fields">
              <div className="mb-3">
                <FieldLabel>Direct answer block</FieldLabel>
                <div className="text-[12px] px-2.5 py-1.5 bg-gray-50 rounded-lg mt-1 text-gray-500">{aeoW >= 40 && aeoW <= 60 ? `${aeoW} words  (in range)` : `${aeoW} words (need 4060)`}</div>
              </div>
              <div className="mb-3">
                <FieldLabel>FAQ pairs</FieldLabel>
                {/* FIX I: show content validity status */}
                <div className="text-[12px] px-2.5 py-1.5 bg-gray-50 rounded-lg mt-1 text-gray-500">
                  {faqs.length} pairs
                  {faqsAreValid(faqs) ? " " : faqs.length < 4 ? " (min 4 for publish)" : " (fill in all questions & answers)"}
                </div>
              </div>
              <div>
                <FieldLabel>Question-led H2s</FieldLabel>
                <div className="text-[12px] px-2.5 py-1.5 bg-gray-50 rounded-lg mt-1 text-gray-500">{h2data.total > 0 ? `${h2data.q} of ${h2data.total} H2s are question-phrased ${h2data.q === h2data.total ? "" : ""}` : "Add content to analyse H2s"}</div>
              </div>
            </GroupPanel>

            <GroupPanel title="Extra metadata">
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <FieldLabel>Short summary</FieldLabel>
</div>
                <div className="text-[12px] px-2.5 py-1.5 bg-gray-50 rounded-lg mt-1 text-gray-500">{summary ? `${summaryLen} chars, ${summarySents} sentence${summarySents !== 1 ? "s" : ""} ${summaryLen <= 300 && summarySents <= 3 ? "" : ""}` : "Edit the Short summary on the left"}</div>
              </div>
              <div className="mb-3">
                <FieldLabel>Entity list</FieldLabel>
                <div className="flex flex-wrap gap-1.5 mb-2 mt-1">{entities.map((e, i) => <TagPill key={i} label={e} onRemove={() => setEntities(entities.filter((_, j) => j !== i))} variant="entity" />)}</div>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-emerald-500"
                  placeholder="Add named entity"
                  value={entityInput}
                  onChange={(e) => setEntityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = entityInput.trim();
                      // FIX R: no duplicate entities
                      if (!v || entities.includes(v)) { setEntityInput(""); return; }
                      setEntities([...entities, v]);
                      setEntityInput("");
                    }
                  }}
                />
              </div>
              <div className="mb-3">
                <FieldLabel>Internal link suggestions</FieldLabel>
                <div className="mt-1 flex flex-wrap gap-1">
                  {["/blog/hospital-digital-marketing", "/services/opd-growth", "/case-study/delhi-hospital"].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        // FIX Q: don't silently add duplicates
                        if (intLinks.includes(s)) return;
                        const empty = intLinks.findIndex((l) => !l);
                        if (empty >= 0) {
                          setIntLinks(intLinks.map((x, i) => i === empty ? s : x));
                        } else {
                          setIntLinks([...intLinks, s]);
                        }
                      }}
                      className={`text-[12px] px-2.5 py-1 rounded-md border transition-colors ${
                        intLinks.includes(s)
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-default"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Author</FieldLabel>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none mt-1" value={author} onChange={(e) => setAuthor(e.target.value)}>
                  <option value="">
                    {isAuthorsLoading ? "Loading authors..." : "Select author"}
                  </option>
                  {authorOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {authorsError && <p className="text-[11px] text-red-600 mt-1">{authorsError}</p>}
              </div>
            </GroupPanel>

            <GroupPanel title="Publishing">
              <div className="mb-3">
                <FieldLabel>Status</FieldLabel>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["draft", "review", "scheduled", "published", "archived"].map((s) => (
                    <button key={s} onClick={() => { setStatus(s); setNoIndex(s === "draft"); }} className={`flex-1 min-w-[70px] py-2 rounded-lg border text-[12px] font-medium capitalize transition-all ${status === s ? (s === "published" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-400 bg-gray-100 text-gray-800") : "border-gray-200 bg-white text-gray-500"}`}>{s}</button>
                  ))}
                </div>
              </div>
              {(status === "published" || status === "scheduled") && (
                <div className="mb-3">
                  <FieldLabel>Publish date</FieldLabel>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none mt-1"
                    value={pubDate}
                    onChange={(e) => setPubDate(e.target.value)}
                  />
                  {/* FIX S: warn on past publish date */}
                  {pubDate && new Date(pubDate) < new Date() && (
                    <p className="text-[11px] text-amber-700 mt-1"> Publish date is in the past</p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-2">
                <span className="text-[13px] text-gray-700">NoIndex</span>
                <Toggle checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} />
              </div>
            </GroupPanel>

            <div className="flex flex-col sm:flex-row gap-2.5 mt-4">
              <button type="button" onClick={(e) => handleSubmit(e, "draft")} disabled={isSubmitting} className="flex-1 py-2.5 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60">Save as draft</button>
              <button type="button" onClick={(e) => handleSubmit(e, "published")} disabled={!canPublish || isSubmitting} className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${canPublish && !isSubmitting ? "bg-emerald-700 text-emerald-50 hover:bg-emerald-800" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>{isSubmitting ? "Publishing..." : "Publish blog"}</button>
            </div>
            {saveMsg && <p className="text-center text-[11px] text-gray-400 mt-2">{saveMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  return <EditorView />;
}



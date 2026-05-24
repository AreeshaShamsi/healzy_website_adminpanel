import axios from "axios";
import { useEffect, useState, useRef } from "react";
import {
  RiAddLine,
  RiCloseLine,
  RiEditLine,
  RiDeleteBinLine,
  RiTwitterXLine,
  RiLinkedinBoxLine,
  RiGlobalLine,
  RiArticleLine,
  RiUserLine,
  RiMailLine,
  RiSearchLine,
  RiEyeLine,
  RiImageAddLine,
  RiCheckLine,
} from "react-icons/ri";

// ── helpers ───────────────────────────────────────────────────────────────────
const initials = (name) =>
  name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const PALETTES = [
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200"    },
  { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-200"  },
  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200"   },
  { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200"    },
];

const AUTHORS_API = import.meta.env.VITE_API_AUTHORS_URL;

const authorsApi = axios.create({
  baseURL: AUTHORS_API,
});

const parseMaybeJson = (value) => {
  if (!value || typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const resolveSocialLinks = (author = {}) => {
  const parsedSocialLinks = parseMaybeJson(author.socialLinks);
  const parsedSocialLinksSnake = parseMaybeJson(author.social_links);
  const parsedSocial = parseMaybeJson(author.social);

  const source =
    (parsedSocialLinks && typeof parsedSocialLinks === "object" && parsedSocialLinks) ||
    (parsedSocialLinksSnake && typeof parsedSocialLinksSnake === "object" && parsedSocialLinksSnake) ||
    (parsedSocial && typeof parsedSocial === "object" && parsedSocial) ||
    {};

  return {
    twitter:
      source.twitter ||
      source.x ||
      author.twitter ||
      author.x ||
      author.socialTwitter ||
      "",
    linkedin:
      source.linkedin ||
      source.linkedIn ||
      author.linkedin ||
      author.linkedIn ||
      author.socialLinkedin ||
      "",
    website:
      source.website ||
      source.site ||
      author.website ||
      author.site ||
      author.socialWebsite ||
      "",
  };
};

const withProtocol = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const getSocialHref = (platform, rawValue) => {
  const value = (rawValue || "").trim();
  if (!value) return "";

  if (platform === "twitter") {
    if (/^(https?:\/\/)?(www\.)?(x|twitter)\.com\//i.test(value)) return withProtocol(value);
    return `https://x.com/${value.replace(/^@/, "")}`;
  }

  if (platform === "linkedin") {
    if (/^(https?:\/\/)?(www\.)?linkedin\.com\//i.test(value)) return withProtocol(value);
    return `https://www.linkedin.com/in/${value.replace(/^@/, "")}`;
  }

  if (platform === "website") return withProtocol(value);
  return "";
};

const mapAuthorFromApi = (author = {}, index = 0) => {
  const socialLinks = resolveSocialLinks(author);
  const id = author._id || author.id;
  return {
    id,
    _id: author._id || id,
    colorIdx: typeof author.colorIdx === "number" ? author.colorIdx : index % PALETTES.length,
    name: author.name || "",
    email: author.email || "",
    shortBio: author.shortBio || "",
    fullBio: author.fullBio || "",
    photo: author.photo || author.photoUrl || "",
    socialLinks: {
      twitter: socialLinks.twitter || "",
      linkedin: socialLinks.linkedin || "",
      website: socialLinks.website || "",
    },
  };
};

// ── FIX 1: Only append photo file if a new one was selected.
//    Also always send existing photoUrl so backend can keep it if no new file.
const buildAuthorFormData = (data) => {
  const fd = new FormData();
  fd.append("name", data.name || "");
  fd.append("email", data.email || "");
  fd.append("shortBio", data.shortBio || "");
  fd.append("fullBio", data.fullBio || "");

  const social = data.socialLinks || {};
  fd.append("twitter", social.twitter || "");
  fd.append("linkedin", social.linkedin || "");
  fd.append("website", social.website || "");
  fd.append("socialLinks[twitter]", social.twitter || "");
  fd.append("socialLinks[linkedin]", social.linkedin || "");
  fd.append("socialLinks[website]", social.website || "");
  fd.append("socialLinks", JSON.stringify({
    twitter: social.twitter || "",
    linkedin: social.linkedin || "",
    website: social.website || "",
  }));
  fd.append("social_links", JSON.stringify({
    twitter: social.twitter || "",
    linkedin: social.linkedin || "",
    website: social.website || "",
  }));

  // If user picked a new file — upload it (Cloudinary will handle on the backend)
  if (data.photoFile instanceof File) {
    fd.append("photo", data.photoFile);
  } else if (data.photo && typeof data.photo === "string") {
    // No new file chosen — pass existing URL so the backend doesn't wipe it
    fd.append("photoUrl", data.photo);
  }

  return fd;
};

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, colorIdx, size = "md", photo }) {
  const p = PALETTES[colorIdx % PALETTES.length];
  const sz =
    size === "lg" ? "w-16 h-16 text-xl" :
    size === "sm" ? "w-8 h-8 text-xs" :
    "w-10 h-10 text-sm";
  if (photo)
    return <img src={photo} alt={name} className={`${sz} rounded-full object-cover ring-2 ${p.border} flex-shrink-0`} />;
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-semibold ring-2 ${p.bg} ${p.text} ${p.border} flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ── CharBar ───────────────────────────────────────────────────────────────────
function CharBar({ value, max }) {
  const pct = Math.min((value.length / max) * 100, 100);
  const over = value.length > max;
  return (
    <div className="mt-1">
      <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${over ? "bg-red-400" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-[11px] mt-0.5 ${over ? "text-red-500" : "text-gray-400"}`}>
        {value.length} / {max}
      </p>
    </div>
  );
}

// ── FieldLabel ────────────────────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

// ── SocialBadge ───────────────────────────────────────────────────────────────
function SocialBadge({ icon, value, platform }) {
  if (!value) return null;
  const href = getSocialHref(platform, value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors"
    >
      {icon}
      <span className="max-w-[100px] truncate">{value}</span>
    </a>
  );
}

// ── VIEW MODAL ────────────────────────────────────────────────────────────────
function ViewModal({ author, onClose, onEdit }) {
  const p = PALETTES[author.colorIdx % PALETTES.length];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* coloured header */}
        <div className={`${p.bg} px-6 pt-6 pb-4`}>
          <div className="flex items-start justify-between mb-4">
            <Avatar name={author.name} colorIdx={author.colorIdx} size="lg" photo={author.photo} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/10 text-gray-600 transition-colors"
            >
              <RiCloseLine size={18} />
            </button>
          </div>
          <h2 className={`text-xl font-semibold ${p.text}`}>{author.name}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
            <RiMailLine size={13} /> {author.email}
          </p>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <SocialBadge platform="twitter" icon={<RiTwitterXLine size={11} />} value={author.socialLinks.twitter} />
            <SocialBadge platform="linkedin" icon={<RiLinkedinBoxLine size={11} />} value={author.socialLinks.linkedin} />
            <SocialBadge platform="website" icon={<RiGlobalLine size={11} />} value={author.socialLinks.website} />
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-1">Short bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {author.shortBio || <span className="text-gray-300 italic">Not set</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-1">Full bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {author.fullBio || <span className="text-gray-300 italic">Not set</span>}
              </p>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); onEdit(author); }}
            className="px-4 py-2 text-[13px] font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors flex items-center gap-1.5"
          >
            <RiEditLine size={14} /> Edit author
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CREATE / EDIT MODAL ───────────────────────────────────────────────────────
function FormModal({ initial, onClose, onSave }) {
  const isEdit = !!initial?.id;
  const fileRef = useRef();
  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    shortBio: initial?.shortBio || "",
    fullBio: initial?.fullBio || "",
    photo: initial?.photo || "",       // existing Cloudinary URL (string)
    photoFile: null,                   // new File object if user picks one
    socialLinks: {
      twitter: initial?.socialLinks?.twitter || "",
      linkedin: initial?.socialLinks?.linkedin || "",
      website: initial?.socialLinks?.website || "",
    },
  });
  const [photoPreview, setPhotoPreview] = useState(initial?.photo || "");
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setSocial = (key, val) =>
    setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: val } }));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    // Store the File for upload; keep existing photo string for fallback display
    setForm((f) => ({ ...f, photoFile: file }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (form.shortBio.length > 160) e.shortBio = "Max 160 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setIsSaving(true);
      const didSave = await onSave({ ...initial, ...form });
      if (didSave !== false) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = (err) =>
    `w-full border ${
      err ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
    } rounded-xl px-3 py-2.5 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 transition-all placeholder:text-gray-300`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">
              {isEdit ? "Edit author" : "Add new author"}
            </h2>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {isEdit
                ? "Update author details below"
                : "Fill in the details to create a new author"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <RiCloseLine size={18} />
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Photo */}
          <div>
            <FieldLabel>Photo</FieldLabel>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <RiUserLine size={22} className="text-gray-300" />
                )}
              </div>
              <div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <RiImageAddLine size={14} /> {photoPreview ? "Change photo" : "Upload photo"}
                </button>
                <p className="text-[11px] text-gray-400 mt-1">JPG / WebP · min 400×400px · via Cloudinary</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <FieldLabel required>Full name</FieldLabel>
            <input
              className={inputCls(errors.name)}
              placeholder="e.g. Priya Sharma"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
            <CharBar value={form.name} max={80} />
          </div>

          {/* Email */}
          <div>
            <FieldLabel required>Email</FieldLabel>
            <div className="relative">
              <RiMailLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                className={`${inputCls(errors.email)} pl-8`}
                placeholder="author@healzy.in"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Short bio */}
          <div>
            <FieldLabel>Short bio</FieldLabel>
            <p className="text-[11px] text-gray-400 mb-1.5">Shown on blog cards — 1 sentence, max 160 chars</p>
            <textarea
              className={inputCls(errors.shortBio)}
              rows={2}
              placeholder="Brief one-liner about the author"
              value={form.shortBio}
              onChange={(e) => set("shortBio", e.target.value)}
            />
            {errors.shortBio && <p className="text-[11px] text-red-500 mt-1">{errors.shortBio}</p>}
            <CharBar value={form.shortBio} max={160} />
          </div>

          {/* Full bio */}
          <div>
            <FieldLabel>Full bio</FieldLabel>
            <p className="text-[11px] text-gray-400 mb-1.5">Author profile page — 2–4 sentences recommended</p>
            <textarea
              className={inputCls(false)}
              rows={4}
              placeholder="Detailed biography for the author profile page"
              value={form.fullBio}
              onChange={(e) => set("fullBio", e.target.value)}
            />
          </div>

          {/* Social links */}
          <div>
            <FieldLabel>Social links</FieldLabel>
            <div className="space-y-2">
              {[
                { key: "twitter",  Icon: RiTwitterXLine,    ph: "@handle",      label: "Twitter / X" },
                { key: "linkedin", Icon: RiLinkedinBoxLine, ph: "profile-slug", label: "LinkedIn"    },
                { key: "website",  Icon: RiGlobalLine,      ph: "https://...",  label: "Website"     },
              ].map(({ key, Icon, ph, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 text-[12px] text-gray-400 flex-shrink-0 flex items-center gap-1.5">
                    <Icon size={13} /> {label}
                  </span>
                  <input
                    className={`${inputCls(false)} flex-1`}
                    placeholder={ph}
                    value={form.socialLinks[key]}
                    onChange={(e) => setSocial(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-[13px] font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            <RiCheckLine size={14} />
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Create author"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DELETE CONFIRM MODAL ──────────────────────────────────────────────────────
function DeleteModal({ author, onClose, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <RiDeleteBinLine size={20} className="text-red-600" />
          </div>
          <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Delete author</h3>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-medium text-gray-800">{author.name}</span>? This cannot be
            undone.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-[13px] text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(author.id); onClose(); }}
            className="flex-1 py-2.5 text-[13px] font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AuthorsPage() {
  const [authors, setAuthors] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const filtered = authors.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const fetchAuthors = async () => {
    try {
      setIsLoading(true);
      const { data } = await authorsApi.get("/");
      const list = Array.isArray(data)
        ? data
        : data?.data || data?.authors || [];
      setAuthors(list.map((item, index) => mapAuthorFromApi(item, index)));
    } catch (error) {
      console.error("Failed to fetch authors:", error);
      window.alert("Failed to fetch authors");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  const openCreate = () => setModal({ type: "form", author: null });

  const openView = async (a) => {
    try {
      const { data } = await authorsApi.get(`/${a._id || a.id}`);
      const item = data?.data || data?.author || data;
      setModal({ type: "view", author: mapAuthorFromApi(item, a.colorIdx || 0) });
    } catch (error) {
      console.error("Failed to fetch author details:", error);
      window.alert("Failed to load author details");
    }
  };

  const openEdit = async (a) => {
    try {
      const { data } = await authorsApi.get(`/${a._id || a.id}`);
      const item = data?.data || data?.author || data;
      setModal({ type: "form", author: mapAuthorFromApi(item, a.colorIdx || 0) });
    } catch (error) {
      console.error("Failed to fetch author for edit:", error);
      window.alert("Failed to load author for editing");
    }
  };

  const openDelete = (a) => setModal({ type: "delete", author: a });
  const closeModal = () => setModal(null);

  const handleSave = async (data) => {
    try {
      const payload = buildAuthorFormData(data);

      if (data.id) {
        const authorId = data._id || data.id;
        await authorsApi.put(`/${authorId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await authorsApi.post("/", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      await fetchAuthors();
      return true;
    } catch (error) {
      console.error("Failed to save author:", error);
      window.alert("Failed to save author");
      return false;
    }
  };

  const handleDelete = async (id) => {
    try {
      await authorsApi.delete(`/${id}`);
      await fetchAuthors();
    } catch (error) {
      console.error("Failed to delete author:", error);
      window.alert("Failed to delete author");
    }
  };

  // ── FIX 2: removed a.blogs — stat cards no longer reference it
  const withSocial = authors.filter((a) => Object.values(a.socialLinks).some(Boolean)).length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── top nav ── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-gray-800">
          <div className="w-6 h-6 rounded-md bg-emerald-700 flex items-center justify-center">
            <RiArticleLine size={13} className="text-white" />
          </div>
          Authors
        </div>
        <span className="text-[12px] text-gray-400 hidden sm:block">Authors</span>
      </div>

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto">
        {/* ── page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Authors</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {authors.length} total author{authors.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-medium rounded-xl transition-colors self-start sm:self-auto"
          >
            <RiAddLine size={16} /> Add author
          </button>
        </div>

        {/* ── stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total authors",     value: authors.length },
            { label: "With social links", value: withSocial },
            { label: "Without social",    value: authors.length - withSocial },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-[11px] text-gray-400 tracking-widest uppercase font-medium">{s.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── table card ── */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {/* search bar */}
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center gap-3">
            <RiSearchLine size={15} className="text-gray-300 flex-shrink-0" />
            <input
              className="flex-1 text-[13px] text-gray-800 placeholder:text-gray-300 focus:outline-none bg-transparent"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500">
                <RiCloseLine size={15} />
              </button>
            )}
          </div>

          {/* ── desktop table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Author", "Email", "Short bio", "Social", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400 px-5 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-14 text-[13px] text-gray-400">
                      {isLoading ? "Loading authors..." : "No authors found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                      onClick={() => openView(a)}
                    >
                      {/* Author */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={a.name} colorIdx={a.colorIdx} photo={a.photo} />
                          <span className="text-[13px] font-medium text-gray-800 whitespace-nowrap">
                            {a.name}
                          </span>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] text-gray-500">{a.email}</span>
                      </td>
                      {/* Short bio */}
                      <td className="px-5 py-3.5 max-w-[220px]">
                        <p className="text-[12px] text-gray-400 truncate">{a.shortBio || "—"}</p>
                      </td>
                      {/* Social */}
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 items-center">
                          {a.socialLinks.twitter && (
                            <a href={getSocialHref("twitter", a.socialLinks.twitter)} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-black transition-colors">
                              <RiTwitterXLine size={14} />
                            </a>
                          )}
                          {a.socialLinks.linkedin && (
                            <a href={getSocialHref("linkedin", a.socialLinks.linkedin)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 transition-colors">
                              <RiLinkedinBoxLine size={14} />
                            </a>
                          )}
                          {a.socialLinks.website && (
                            <a href={getSocialHref("website", a.socialLinks.website)} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-black transition-colors">
                              <RiGlobalLine size={14} />
                            </a>
                          )}
                          {!a.socialLinks.twitter && !a.socialLinks.linkedin && !a.socialLinks.website && (
                            <span className="text-[12px] text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="View"
                            onClick={() => openView(a)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <RiEyeLine size={15} />
                          </button>
                          <button
                            title="Edit"
                            onClick={() => openEdit(a)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-700 transition-colors"
                          >
                            <RiEditLine size={15} />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => openDelete(a)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <RiDeleteBinLine size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── mobile card list ── */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="py-14 text-center text-[13px] text-gray-400">
                {isLoading ? "Loading authors..." : "No authors found."}
              </div>
            ) : (
              filtered.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openView(a)}
                >
                  <Avatar name={a.name} colorIdx={a.colorIdx} photo={a.photo} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{a.name}</p>
                    <p className="text-[12px] text-gray-400 truncate">{a.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                        {a.socialLinks.twitter && (
                          <a href={getSocialHref("twitter", a.socialLinks.twitter)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-black transition-colors">
                            <RiTwitterXLine size={12} />
                          </a>
                        )}
                        {a.socialLinks.linkedin && (
                          <a href={getSocialHref("linkedin", a.socialLinks.linkedin)} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600 transition-colors">
                            <RiLinkedinBoxLine size={12} />
                          </a>
                        )}
                        {a.socialLinks.website && (
                          <a href={getSocialHref("website", a.socialLinks.website)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-black transition-colors">
                            <RiGlobalLine size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* mobile actions */}
                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(a)}
                      className="p-2 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-700 transition-colors"
                    >
                      <RiEditLine size={15} />
                    </button>
                    <button
                      onClick={() => openDelete(a)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <RiDeleteBinLine size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* table footer */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-[12px] text-gray-400">
              Showing {filtered.length} of {authors.length} author{authors.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── modals ── */}
      {modal?.type === "view" && (
        <ViewModal author={modal.author} onClose={closeModal} onEdit={openEdit} />
      )}
      {modal?.type === "form" && (
        <FormModal initial={modal.author} onClose={closeModal} onSave={handleSave} />
      )}
      {modal?.type === "delete" && (
        <DeleteModal author={modal.author} onClose={closeModal} onConfirm={handleDelete} />
      )}
    </div>
  );
}

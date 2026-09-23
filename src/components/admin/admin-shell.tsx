"use client";

import {
  type FormEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  Eye,
  EyeOff,
  FilePenLine,
  LogOut,
  Plus,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

import {
  logoutAction,
  saveWordAction,
  togglePublishedAction,
} from "@/app/actions";
import type { ActionState, Word, WordType } from "@/lib/types";
import { WORD_TYPES } from "@/lib/types";
import { AdminNavigation } from "@/components/admin/admin-navigation";

type AdminShellProps = {
  words: Word[];
  loadError: string | null;
  supabaseConfigured: boolean;
};

type StatusFilter = "all" | "published" | "draft" | "free" | "paid";

const initialActionState: ActionState = {
  ok: false,
  message: "",
};

const wordTypeLabels: Record<WordType, string> = {
  wanderword: "Wanderword",
  hidden_english: "Hidden English",
  psychology: "Psychology",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold",
        published
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-900",
      )}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function TypeBadge({ type }: { type: WordType }) {
  const styles: Record<WordType, string> = {
    wanderword: "bg-cyan-100 text-cyan-800",
    hidden_english: "bg-violet-100 text-violet-800",
    psychology: "bg-rose-100 text-rose-800",
  };

  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold",
        styles[type],
      )}
    >
      {wordTypeLabels[type]}
    </span>
  );
}

function WordPreview({ word }: { word: Word | null }) {
  if (!word) {
    return (
      <aside className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No word selected.
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            App Preview
          </h2>
          <StatusBadge published={word.published} />
        </div>
      </div>
      <div className="p-5">
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-inner">
          <div className="min-h-[520px] rounded-[20px] bg-[#fbfbf8] p-5 text-slate-950">
            <div className="mb-8 flex items-center justify-between">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                Level {word.level}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {word.language}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-500">
              {wordTypeLabels[word.type]}
            </p>
            <h3 className="mt-2 break-words text-4xl font-semibold leading-tight text-slate-950">
              {word.word}
            </h3>
            <p className="mt-2 break-words font-mono text-sm text-slate-500">
              {word.pronunciation}
            </p>

            <div className="mt-8 space-y-5">
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Definition
                </h4>
                <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">
                  {word.definition}
                </p>
              </section>
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Wisdom
                </h4>
                <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">
                  {word.wisdom}
                </p>
              </section>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {word.is_free ? "Free" : "Paid"}
              </span>
              {word.audio_url ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Audio
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function WordEditor({
  word,
  onClose,
  onSaved,
}: {
  word: Word | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    saveWordAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onSaved();
    }
  }, [onSaved, router, state.ok]);

  const title = word ? "Edit Word" : "New Word";

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="word-editor-title"
    >
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="word-editor-title"
              className="text-lg font-semibold text-slate-950"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {word?.slug ?? "Draft"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close editor"
            title="Close"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <input type="hidden" name="id" value={word?.id ?? ""} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Word"
                name="word"
                defaultValue={word?.word ?? ""}
                error={state.fieldErrors?.word?.[0]}
                required
              />
              <Field
                label="Slug"
                name="slug"
                defaultValue={word?.slug ?? ""}
                error={state.fieldErrors?.slug?.[0]}
                placeholder="auto-generated"
              />
              <Field
                label="Pronunciation"
                name="pronunciation"
                defaultValue={word?.pronunciation ?? ""}
                error={state.fieldErrors?.pronunciation?.[0]}
                required
              />
              <Field
                label="Language"
                name="language"
                defaultValue={word?.language ?? "English"}
                error={state.fieldErrors?.language?.[0]}
                required
              />
              <div>
                <label
                  htmlFor="type"
                  className="text-sm font-medium text-slate-700"
                >
                  Type
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={word?.type ?? "wanderword"}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                >
                  {WORD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {wordTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="level"
                  className="text-sm font-medium text-slate-700"
                >
                  Level
                </label>
                <select
                  id="level"
                  name="level"
                  defaultValue={word?.level ?? 1}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <TextArea
                label="Definition"
                name="definition"
                defaultValue={word?.definition ?? ""}
                error={state.fieldErrors?.definition?.[0]}
                rows={5}
              />
              <TextArea
                label="Wisdom"
                name="wisdom"
                defaultValue={word?.wisdom ?? ""}
                error={state.fieldErrors?.wisdom?.[0]}
                rows={5}
              />
              <Field
                label="Audio URL"
                name="audio_url"
                type="url"
                defaultValue={word?.audio_url ?? ""}
                error={state.fieldErrors?.audio_url?.[0]}
                placeholder="https://..."
              />
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="is_free"
                defaultChecked={word?.is_free ?? true}
                className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              Free in the mobile app
            </label>

            {state.message ? (
              <p
                className={cx(
                  "mt-4 rounded-lg border px-3 py-2 text-sm",
                  state.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800",
                )}
              >
                {state.message}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              name="intent"
              value="draft"
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePenLine aria-hidden="true" size={16} />
              Save Draft
            </button>
            <button
              type="submit"
              name="intent"
              value="publish"
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              <Check aria-hidden="true" size={16} />
              Save and Publish
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  error,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

function TextArea({
  label,
  name,
  error,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

export function AdminShell({
  words,
  loadError,
  supabaseConfigured,
}: AdminShellProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<WordType | "all">("all");
  const [level, setLevel] = useState<number | "all">("all");
  const [selectedId, setSelectedId] = useState(words[0]?.id ?? "");
  const [editingWord, setEditingWord] = useState<Word | null | undefined>();
  const [notice, setNotice] = useState("");
  const [pendingToggleId, setPendingToggleId] = useState("");
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const published = words.filter((word) => word.published).length;

    return {
      total: words.length,
      published,
      drafts: words.length - published,
      free: words.filter((word) => word.is_free).length,
    };
  }, [words]);

  const filteredWords = useMemo(() => {
    const search = normalizeSearch(query);

    return words.filter((word) => {
      const matchesSearch =
        !search ||
        [
          word.word,
          word.slug,
          word.pronunciation,
          word.language,
          word.definition,
          word.wisdom,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      const matchesStatus =
        status === "all" ||
        (status === "published" && word.published) ||
        (status === "draft" && !word.published) ||
        (status === "free" && word.is_free) ||
        (status === "paid" && !word.is_free);
      const matchesType = type === "all" || word.type === type;
      const matchesLevel = level === "all" || word.level === level;

      return matchesSearch && matchesStatus && matchesType && matchesLevel;
    });
  }, [level, query, status, type, words]);

  const visibleSelectedId = filteredWords.some((word) => word.id === selectedId)
    ? selectedId
    : filteredWords[0]?.id ?? "";
  const selectedWord =
    filteredWords.find((word) => word.id === visibleSelectedId) ?? null;

  function togglePublished(word: Word) {
    const formData = new FormData();
    formData.set("id", word.id);
    formData.set("published", String(!word.published));
    setPendingToggleId(word.id);

    startTransition(async () => {
      const result = await togglePublishedAction(formData);
      setNotice(result.message);
      setPendingToggleId("");

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function openNewWord() {
    setEditingWord(null);
  }

  function closeEditor() {
    setEditingWord(undefined);
  }

  function clearFilters(event: FormEvent) {
    event.preventDefault();
    setQuery("");
    setStatus("all");
    setType("all");
    setLevel("all");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Emotionary
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              Word Admin
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw aria-hidden="true" size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openNewWord}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus aria-hidden="true" size={16} />
              New Word
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut aria-hidden="true" size={17} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <AdminNavigation current="words" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {!supabaseConfigured ? (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Missing Supabase service-role configuration.
          </div>
        ) : null}

        {loadError ? (
          <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total" value={stats.total} tone="slate" />
          <Stat label="Published" value={stats.published} tone="emerald" />
          <Stat label="Drafts" value={stats.drafts} tone="amber" />
          <Stat label="Free" value={stats.free} tone="cyan" />
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <form
                onSubmit={clearFilters}
                className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_170px_130px_auto]"
              >
                <label className="relative block">
                  <span className="sr-only">Search words</span>
                  <Search
                    aria-hidden="true"
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search words"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
                <label>
                  <span className="sr-only">Status</span>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as StatusFilter)
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="all">All status</option>
                    <option value="published">Published</option>
                    <option value="draft">Drafts</option>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Type</span>
                  <select
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as WordType | "all")
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="all">All types</option>
                    {WORD_TYPES.map((wordType) => (
                      <option key={wordType} value={wordType}>
                        {wordTypeLabels[wordType]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Level</span>
                  <select
                    value={level}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLevel(value === "all" ? "all" : Number(value));
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="all">All levels</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        Level {value}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              </form>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Word
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Type
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Level
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Updated
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWords.map((word) => (
                    <tr
                      key={word.id}
                      className={cx(
                        "cursor-pointer transition hover:bg-slate-50",
                        visibleSelectedId === word.id && "bg-emerald-50/70",
                      )}
                      onClick={() => setSelectedId(word.id)}
                    >
                      <td className="border-b border-slate-100 px-4 py-4">
                        <div className="font-semibold text-slate-950">
                          {word.word}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {word.slug}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <TypeBadge type={word.type} />
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-700">
                        {word.level}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <StatusBadge published={word.published} />
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                        {formatDate(word.updated_at)}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingWord(word);
                            }}
                            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-white"
                            aria-label={`Edit ${word.word}`}
                            title="Edit"
                          >
                            <FilePenLine aria-hidden="true" size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePublished(word);
                            }}
                            disabled={isPending && pendingToggleId === word.id}
                            className={cx(
                              "grid size-9 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60",
                              word.published
                                ? "border-amber-200 text-amber-800 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
                            )}
                            aria-label={
                              word.published
                                ? `Unpublish ${word.word}`
                                : `Publish ${word.word}`
                            }
                            title={word.published ? "Unpublish" : "Publish"}
                          >
                            {word.published ? (
                              <EyeOff aria-hidden="true" size={16} />
                            ) : (
                              <Eye aria-hidden="true" size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredWords.map((word) => (
                <article
                  key={word.id}
                  className={cx(
                    "px-4 py-4 transition hover:bg-slate-50",
                    visibleSelectedId === word.id && "bg-emerald-50/70",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(word.id)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-950">
                          {word.word}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {word.slug}
                        </div>
                      </div>
                      <StatusBadge published={word.published} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <TypeBadge type={word.type} />
                      <span className="inline-flex h-7 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700">
                        Level {word.level}
                      </span>
                      <span className="inline-flex h-7 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700">
                        {word.is_free ? "Free" : "Paid"}
                      </span>
                    </div>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingWord(word);
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                    >
                      <FilePenLine aria-hidden="true" size={15} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePublished(word);
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                    >
                      {word.published ? (
                        <EyeOff aria-hidden="true" size={15} />
                      ) : (
                        <Eye aria-hidden="true" size={15} />
                      )}
                      {word.published ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!filteredWords.length ? (
              <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
                <div>
                  <BookOpen
                    aria-hidden="true"
                    className="mx-auto text-slate-300"
                    size={36}
                  />
                  <p className="mt-3 font-semibold text-slate-800">
                    No words found
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Adjust filters or add a new word.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <div className="lg:sticky lg:top-5 lg:self-start">
            <WordPreview word={selectedWord} />
          </div>
        </div>
      </div>

      {editingWord !== undefined ? (
        <WordEditor
          key={editingWord?.id ?? "new-word"}
          word={editingWord}
          onClose={closeEditor}
          onSaved={closeEditor}
        />
      ) : null}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "amber" | "cyan";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
  };

  return (
    <div className={cx("rounded-lg border px-4 py-3", tones[tone])}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

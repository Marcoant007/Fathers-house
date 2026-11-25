"use client";

// Tira-dúvidas flutuante do site público. Sem IA: busca o conhecimento em
// /api/assistente quando o visitante abre (ou passa o mouse no botão) e
// responde no próprio navegador com src/lib/assistant/engine.ts.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, ChevronRight, List, RotateCcw, X } from "lucide-react";
import { cn } from "cn";
import { LogoGlyph, LogoMark } from "@/components/site/Logo";
import { answer, getSuggestions } from "@/lib/assistant/engine";
import type { AssistantKnowledge, AssistantLink } from "@/lib/assistant/types";

type Message = {
  id: number;
  from: "bot" | "user";
  text: string;
  links?: AssistantLink[];
  showSuggestions?: boolean;
};

const WELCOME: Message = {
  id: 0,
  from: "bot",
  text: "Oi! 👋 Pergunte sobre cultos, eventos, endereço ou escolha uma das perguntas abaixo.",
  showSuggestions: true,
};

const isInternal = (href: string) => href.startsWith("/");

export function AssistantWidget() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [knowledge, setKnowledge] = useState<AssistantKnowledge | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const loading = useRef(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setLoadError(false);
    try {
      const res = await fetch("/api/assistente");
      if (!res.ok) throw new Error(String(res.status));
      setKnowledge(await res.json());
    } catch {
      setLoadError(true);
    } finally {
      loading.current = false;
    }
  }, []);

  const prefetch = () => {
    if (!knowledge) void load();
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function ask(question: string) {
    const text = question.trim().slice(0, 300);
    if (!text || !knowledge) return;
    const reply = answer(text, knowledge);
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showSuggestions: false })),
      { id: nextId.current++, from: "user", text },
      { id: nextId.current++, from: "bot", ...reply },
    ]);
    setInput("");
  }

  /** Volta a mostrar as perguntas frequentes, sem apagar a conversa. */
  function showMenu() {
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showSuggestions: false })),
      { id: nextId.current++, from: "bot", text: "Escolha outra pergunta ou digite a sua.", showSuggestions: true },
    ]);
  }

  /** Limpa a conversa e volta pro começo. */
  function restart() {
    setMessages([WELCOME]);
    setInput("");
    inputRef.current?.focus();
  }

  const lastMessage = messages[messages.length - 1];

  const suggestions = knowledge ? getSuggestions(knowledge) : [];

  return (
    <>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Tira-dúvidas"
          className="fixed right-3 bottom-24 left-3 z-40 flex max-h-[min(620px,calc(100dvh-7.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl sm:right-5 sm:left-auto sm:w-[390px]"
        >
          <div className="flex items-center gap-2 bg-ink py-3 pr-2 pl-4 text-paper">
            <LogoMark onDark className="h-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-extrabold whitespace-nowrap">Tira-dúvidas</p>
              <p className="truncate text-xs text-soft-dark">Respostas automáticas sobre a igreja</p>
            </div>
            {messages.length > 1 ? (
              <button
                type="button"
                onClick={restart}
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-soft-dark hover:text-paper"
              >
                <RotateCcw size={16} strokeWidth={2.5} aria-hidden="true" />
                Recomeçar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              aria-label="Fechar tira-dúvidas"
              className="flex size-11 items-center justify-center rounded-xl text-soft-dark hover:text-paper"
            >
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div ref={scrollRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-3">
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line",
                    m.from === "bot"
                      ? "self-start rounded-tl-md border border-line bg-card text-ink"
                      : "self-end rounded-tr-md bg-ink text-paper"
                  )}
                >
                  {m.from === "user" ? <span className="sr-only">Você: </span> : null}
                  {m.text}
                  {m.links && m.links.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.links.map((link) =>
                        isInternal(link.href) ? (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex min-h-11 items-center rounded-full border-2 border-ink px-4 text-sm font-extrabold whitespace-nowrap hover:bg-ink hover:text-paper"
                          >
                            {link.label}
                          </Link>
                        ) : (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-ink px-4 text-sm font-extrabold whitespace-nowrap hover:bg-ink hover:text-paper"
                          >
                            {link.label}
                            <ArrowUpRight size={16} strokeWidth={2.5} aria-hidden="true" />
                            <span className="sr-only">(abre em nova aba)</span>
                          </a>
                        )
                      )}
                    </div>
                  ) : null}
                </div>

                {m.showSuggestions && suggestions.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="label-caps text-soft">Perguntas frequentes</p>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left text-sm font-bold hover:border-ink"
                      >
                        {s}
                        <ChevronRight size={16} strokeWidth={2.5} className="shrink-0 text-soft" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : null}

                {m === lastMessage && m.from === "bot" && !m.showSuggestions && suggestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={showMenu}
                    className="flex min-h-11 items-center gap-2 self-start rounded-full border-2 border-line bg-card px-4 text-sm font-extrabold hover:border-ink"
                  >
                    <List size={16} strokeWidth={2.5} aria-hidden="true" />
                    Ver outras perguntas
                  </button>
                ) : null}
              </div>
            ))}

            {!knowledge && !loadError ? <p className="text-sm text-soft">Carregando…</p> : null}
            {loadError ? (
              <div className="flex flex-col items-start gap-2 text-sm text-soft">
                <p>Não consegui carregar as respostas agora.</p>
                <button type="button" onClick={() => void load()} className="link-more text-ink">
                  Tentar de novo
                </button>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex flex-col gap-2 border-t border-line bg-paper p-3"
          >
            <div className="flex items-center gap-2">
              <label htmlFor={`${panelId}-input`} className="sr-only">
                Sua pergunta
              </label>
              <input
                id={`${panelId}-input`}
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={300}
                autoComplete="off"
                placeholder="Ex.: tem culto hoje?"
                className="h-12 min-w-0 flex-1 rounded-full border-2 border-line bg-card px-4 text-[15px] outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={!input.trim() || !knowledge}
                aria-label="Enviar pergunta"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
              >
                <ArrowUp size={20} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
            <p className="text-center text-[11px] text-soft">
              Respostas automáticas com base na programação da igreja.
            </p>
          </form>
        </div>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          if (!open) prefetch();
          setOpen(!open);
        }}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Fechar tira-dúvidas" : "Abrir tira-dúvidas"}
        title={open ? undefined : "Tira-dúvidas"}
        className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent-icon shadow-lg ring-4 ring-paper transition-transform hover:scale-105"
      >
        {open ? <X size={24} strokeWidth={2.5} aria-hidden="true" /> : <LogoGlyph className="w-9" />}
      </button>
    </>
  );
}

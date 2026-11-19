import { useMutation, useQuery } from "convex/react";
import { MessageCircle, Send } from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { chatMessageLimit } from "../../shared/chat";
import { type Credentials, errorMessage } from "../session";
import { Drawer } from "../ui/controls";

const chatTime = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

type Channel = "village" | "eliminated";
type Composer = { scope: string; draft: string; error: string };

export function Chat({
  credentials,
  me,
  open,
  onOpen,
  onClose,
}: {
  credentials: Credentials;
  me: Id<"players">;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const history = useQuery(api.chat.history, credentials);
  const send = useMutation(api.chat.send);
  const [villageForMatch, setVillageForMatch] = useState<Id<"matches">>();
  const [composer, setComposer] = useState<Composer>();
  const [sending, setSending] = useState(false);
  const [seen, setSeen] = useState<Partial<Record<Channel, Id<"messages">>>>(
    {},
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const eliminated = history?.eliminated;
  const privateThread =
    eliminated && villageForMatch !== eliminated.match ? eliminated : null;
  const channel: Channel = privateThread ? "eliminated" : "village";
  const scope = privateThread?.match ?? "village";
  const lastScope = useRef(scope);
  const draft = composer?.scope === scope ? composer.draft : "";
  const error = composer?.scope === scope ? composer.error : "";
  const messages = privateThread?.messages ?? history?.messages;
  const lastMessage = messages?.at(-1);
  const villageIncoming = lastFromOthers(history?.messages, me);
  const eliminatedIncoming = lastFromOthers(eliminated?.messages, me);
  const currentIncoming = privateThread ? eliminatedIncoming : villageIncoming;
  const villageUnread = villageIncoming && villageIncoming !== seen.village;
  const eliminatedUnread =
    eliminatedIncoming && eliminatedIncoming !== seen.eliminated;
  const unread = !open && (villageUnread || eliminatedUnread);
  const writeBlock = privateThread ? null : history?.writeBlock;
  const canSend = writeBlock === null;

  useEffect(() => {
    if (open && currentIncoming)
      setSeen((previous) =>
        previous[channel] === currentIncoming
          ? previous
          : { ...previous, [channel]: currentIncoming },
      );
  }, [open, channel, currentIncoming]);

  useLayoutEffect(() => {
    if (open) thread.current?.focus();
    follow.current = true;
  }, [open]);

  useLayoutEffect(() => {
    if (lastScope.current !== scope) {
      lastScope.current = scope;
      follow.current = true;
    }
    if (!open || !lastMessage?.id) return;
    const element = thread.current;
    if (element && follow.current) element.scrollTop = element.scrollHeight;
  }, [open, scope, lastMessage?.id]);

  const close = () => {
    onClose();
    trigger.current?.focus();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!canSend || sending || !text) return;
    setSending(true);
    setComposer({ scope, draft, error: "" });
    try {
      await send({
        ...credentials,
        text,
        ...(privateThread ? { match: privateThread.match } : {}),
      });
      setComposer((current) =>
        current?.scope === scope ? undefined : current,
      );
      if (lastScope.current === scope) {
        follow.current = true;
        const element = thread.current;
        if (element) element.scrollTop = element.scrollHeight;
      }
    } catch (cause) {
      setComposer((current) =>
        current?.scope === scope
          ? { ...current, error: errorMessage(cause) }
          : current,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button chat-toggle"
        aria-label={
          unread ? "Chat du village, nouveaux messages" : "Chat du village"
        }
        aria-expanded={open}
        title="Chat du village"
        onClick={onOpen}
      >
        <MessageCircle size={18} />
        {unread && <span className="chat-unread" aria-hidden="true" />}
      </button>
      {open &&
        createPortal(
          <Drawer open title="Chat du village" onClose={close}>
            <div className="room-chat">
              {eliminated && (
                <fieldset className="chat-channels">
                  <legend className="sr-only">Conversations</legend>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={channel === "village"}
                    onClick={() => setVillageForMatch(eliminated.match)}
                  >
                    Village
                    {channel !== "village" && villageUnread && (
                      <>
                        <span className="chat-unread" aria-hidden="true" />
                        <span className="sr-only">, nouveaux messages</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={channel === "eliminated"}
                    onClick={() => setVillageForMatch(undefined)}
                  >
                    Éliminés
                    {channel !== "eliminated" && eliminatedUnread && (
                      <>
                        <span className="chat-unread" aria-hidden="true" />
                        <span className="sr-only">, nouveaux messages</span>
                      </>
                    )}
                  </button>
                </fieldset>
              )}
              {privateThread && (
                <p className="chat-status">
                  Visible uniquement par les joueurs éliminés.
                </p>
              )}
              <div
                className="chat-thread"
                ref={thread}
                role="log"
                aria-label={
                  privateThread ? "Messages des éliminés" : "Messages du salon"
                }
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the message history.
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") event.stopPropagation();
                }}
                onScroll={(event) => {
                  const { scrollTop, scrollHeight, clientHeight } =
                    event.currentTarget;
                  follow.current = scrollHeight - scrollTop - clientHeight < 32;
                }}
              >
                {!messages?.length ? (
                  <p className="chat-status">
                    {messages ? "Aucun message pour l’instant." : "Chargement…"}
                  </p>
                ) : (
                  <ul className="chat-messages">
                    {messages.map((message) => (
                      <li
                        key={message.id}
                        className={
                          message.author === me ? "chat-own" : undefined
                        }
                      >
                        <div className="chat-meta">
                          <strong>{message.name}</strong>
                          <time dateTime={new Date(message.time).toISOString()}>
                            {chatTime.format(message.time)}
                          </time>
                        </div>
                        <p>{message.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {writeBlock && (
                <p className="chat-status" role="status">
                  {writeBlock}
                </p>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <form className="chat-compose" onSubmit={submit}>
                <input
                  aria-label="Ton message"
                  placeholder="Ton message…"
                  value={draft}
                  maxLength={chatMessageLimit}
                  autoComplete="off"
                  disabled={!canSend}
                  readOnly={sending}
                  onChange={(event) =>
                    setComposer({ scope, draft: event.target.value, error: "" })
                  }
                />
                <button
                  type="submit"
                  className="icon-button solid"
                  aria-label="Envoyer"
                  title="Envoyer"
                  disabled={!canSend || sending || !draft.trim()}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </Drawer>,
          document.body,
        )}
    </>
  );
}

function lastFromOthers(
  messages: { id: Id<"messages">; author: Id<"players"> }[] | undefined,
  me: Id<"players">,
) {
  return messages?.filter((message) => message.author !== me).at(-1)?.id;
}

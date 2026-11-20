import { useMutation, useQuery } from "convex/react";
import {
  Ghost,
  Lock,
  MessageCircle,
  MessagesSquare,
  Send,
  Skull,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { chatMessageLimit } from "../../shared/chat";
import { characters } from "../../shared/rules";
import { type Credentials, errorMessage } from "../session";
import { Drawer } from "../ui/controls";

const chatTime = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});
/** Consecutive messages from one author within this window share a header. */
const groupWindow = 5 * 60_000;
/** The character counter appears once a draft gets this close to the limit. */
const counterMargin = 60;

type Channel = "village" | "eliminated" | "spirits";
const channelInfo: Record<
  Channel,
  { label: string; icon: ReactNode; notice?: string; empty: string }
> = {
  village: {
    label: "Village",
    icon: <MessagesSquare size={16} />,
    empty: "Aucun message pour l’instant. Lance le débat !",
  },
  eliminated: {
    label: "Éliminés",
    icon: <Skull size={16} />,
    notice: "Visible uniquement par les joueurs éliminés.",
    empty: "Les éliminés se retrouvent ici. Personne d’autre ne vous lit.",
  },
  spirits: {
    label: "Esprits",
    icon: <Ghost size={16} />,
    notice: "Le Nécromancien et les éliminés peuvent se parler ici la nuit.",
    empty: "Le Nécromancien vous écoute peut-être cette nuit…",
  },
};
type Composer = { scope: string; draft: string; error: string };
type Message = {
  id: Id<"messages">;
  time: number;
  author?: Id<"players">;
  name: string;
  text: string;
};
type Member = { id: Id<"players">; character: number };

export function Chat({
  credentials,
  me,
  members,
  open,
  onOpen,
  onClose,
}: {
  credentials: Credentials;
  me: Id<"players">;
  members: Member[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const history = useQuery(api.chat.history, credentials);
  const send = useMutation(api.chat.send);
  const [selection, setSelection] = useState<{
    match: Id<"matches">;
    channel: Channel;
  }>();
  const [composer, setComposer] = useState<Composer>();
  const [sending, setSending] = useState(false);
  const [seen, setSeen] = useState<Partial<Record<Channel, Id<"messages">>>>(
    {},
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const follow = useRef(true);
  const eliminated = history?.eliminated;
  const spirits = history?.spirits;
  const activeMatch = spirits?.match ?? eliminated?.match;
  const channels: Channel[] = ["village"];
  if (eliminated) channels.push("eliminated");
  if (spirits) channels.push("spirits");
  const channel =
    selection?.match === activeMatch &&
    selection &&
    channels.includes(selection.channel)
      ? selection.channel
      : spirits
        ? "spirits"
        : eliminated
          ? "eliminated"
          : "village";
  const privateThread =
    channel === "spirits"
      ? spirits
      : channel === "eliminated"
        ? eliminated
        : null;
  const scope = `${channel}:${privateThread?.match ?? ""}`;
  const lastScope = useRef(scope);
  const draft = composer?.scope === scope ? composer.draft : "";
  const error = composer?.scope === scope ? composer.error : "";
  const messages = privateThread?.messages ?? history?.messages;
  const lastMessage = messages?.at(-1);
  const incoming = {
    village: lastFromOthers(history?.messages, me),
    eliminated: lastFromOthers(eliminated?.messages, me),
    spirits: lastFromOthers(spirits?.messages, me),
  };
  const isUnread = (key: Channel) =>
    incoming[key] !== undefined && incoming[key] !== seen[key];
  const currentIncoming = incoming[channel];
  const unread = !open && channels.some(isUnread);
  const writeBlock = privateThread ? null : history?.writeBlock;
  const canSend = writeBlock === null;
  const info = channelInfo[channel];

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

  const select = (key: Channel) => {
    if (activeMatch) setSelection({ match: activeMatch, channel: key });
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
        ...(channel === "spirits" ? { spirits: true } : {}),
      });
      setComposer((current) =>
        current?.scope === scope ? undefined : current,
      );
      if (lastScope.current === scope) {
        follow.current = true;
        const element = thread.current;
        if (element) element.scrollTop = element.scrollHeight;
        input.current?.focus();
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
        aria-label={unread ? "Chat, nouveaux messages" : "Chat"}
        aria-expanded={open}
        title="Chat"
        onClick={onOpen}
      >
        <MessageCircle size={18} />
        {unread && <span className="chat-unread" aria-hidden="true" />}
      </button>
      {open &&
        createPortal(
          <Drawer open title="Chat" onClose={close}>
            <div className="room-chat" data-channel={channel}>
              {channels.length > 1 && (
                <div
                  className="chat-tabs"
                  role="tablist"
                  aria-label="Conversations"
                >
                  {channels.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      data-channel={key}
                      aria-selected={channel === key}
                      onClick={() => select(key)}
                    >
                      {channelInfo[key].icon}
                      {channelInfo[key].label}
                      {channel !== key && isUnread(key) && (
                        <>
                          <span className="chat-unread" aria-hidden="true" />
                          <span className="sr-only">, nouveaux messages</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {info.notice && (
                <p className="chat-notice">
                  {info.icon}
                  {info.notice}
                </p>
              )}
              <div
                className="chat-thread"
                ref={thread}
                role="log"
                aria-label={`Messages · ${info.label}`}
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
                  <p className="chat-empty">
                    {info.icon}
                    {messages ? info.empty : "Chargement…"}
                  </p>
                ) : (
                  <MessageGroups
                    messages={messages}
                    me={me}
                    members={members}
                  />
                )}
              </div>
              {error && (
                <p className="error chat-error" role="alert">
                  {error}
                </p>
              )}
              {writeBlock ? (
                <div className="chat-locked" role="status">
                  <Lock size={16} aria-hidden="true" />
                  <span>{writeBlock}</span>
                  {eliminated && (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => select("eliminated")}
                    >
                      Écrire aux éliminés
                    </button>
                  )}
                </div>
              ) : (
                <form className="chat-compose" onSubmit={submit}>
                  <input
                    ref={input}
                    aria-label={`Ton message · ${info.label}`}
                    placeholder={`Écrire · ${info.label}`}
                    value={draft}
                    maxLength={chatMessageLimit}
                    autoComplete="off"
                    enterKeyHint="send"
                    readOnly={sending}
                    onChange={(event) =>
                      setComposer({
                        scope,
                        draft: event.target.value,
                        error: "",
                      })
                    }
                  />
                  {draft.length > chatMessageLimit - counterMargin && (
                    <span className="chat-counter" aria-live="polite">
                      {chatMessageLimit - draft.length}
                    </span>
                  )}
                  <button
                    type="submit"
                    className="icon-button solid"
                    aria-label="Envoyer"
                    title="Envoyer"
                    disabled={sending || !draft.trim()}
                  >
                    <Send size={18} />
                  </button>
                </form>
              )}
            </div>
          </Drawer>,
          document.body,
        )}
    </>
  );
}

/** Renders runs of messages from the same author under a single header. */
function MessageGroups({
  messages,
  me,
  members,
}: {
  messages: Message[];
  me: Id<"players">;
  members: Member[];
}) {
  const groups: Message[][] = [];
  for (const message of messages) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (
      group &&
      previous &&
      previous.author === message.author &&
      previous.name === message.name &&
      message.time - previous.time < groupWindow
    )
      group.push(message);
    else groups.push([message]);
  }
  return (
    <ol className="chat-messages">
      {groups.map((group) => {
        const [first] = group;
        const own = first.author === me;
        const member = members.find((entry) => entry.id === first.author);
        const look = member ? characters[member.character] : undefined;
        return (
          <li key={first.id} className={own ? "chat-group own" : "chat-group"}>
            {!own && (
              <span
                className="person-dot chat-avatar"
                style={
                  look
                    ? { background: look.color, borderColor: look.trim }
                    : undefined
                }
                aria-hidden="true"
              >
                {first.author ? first.name.slice(0, 1) : <Ghost size={13} />}
              </span>
            )}
            <div className="chat-group-body">
              <div className="chat-meta">
                <strong>{own ? "Toi" : first.name}</strong>
                <time dateTime={new Date(first.time).toISOString()}>
                  {chatTime.format(first.time)}
                </time>
              </div>
              {group.map((message) => (
                <p key={message.id} className="chat-bubble">
                  {message.text}
                </p>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function lastFromOthers(
  messages: { id: Id<"messages">; author?: Id<"players"> }[] | undefined,
  me: Id<"players">,
) {
  return messages?.filter((message) => message.author !== me).at(-1)?.id;
}

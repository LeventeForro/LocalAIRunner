import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, Paperclip, ChevronDown, Square, Copy, Check,
  Zap, Clock, Image as ImageIcon, X, Bot, UserRound, WandSparkles
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const CodeBlock = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("A kód másolása nem sikerült:", error);
    }
  };

  return !inline && match ? (
    <div className="chat-code-block">
      <div className="chat-code-header">
        <span>{match[1]}</span>
        <button type="button" onClick={handleCopy} title="Kód másolása">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Másolva" : "Másolás"}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        className="chat-code-content"
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  ) : (
    <code className="chat-inline-code" {...props}>{children}</code>
  );
};

export default function ChatPanel({ activeSession, onChatUpdated, newChatTrigger }) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [abortController, setAbortController] = useState(null);

  const [model, setModel] = useState("Modellek betöltése…");
  const [availableModels, setAvailableModels] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [imageModel, setImageModel] = useState("Modellek betöltése…");
  const [availableImageModels, setAvailableImageModels] = useState([]);
  const [isImageDropdownOpen, setIsImageDropdownOpen] = useState(false);
  const [isImageMode, setIsImageMode] = useState(false);

  const [attachedImage, setAttachedImage] = useState(null);
  const [attachedImagePreview, setAttachedImagePreview] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const fileInputRef = useRef(null);
  const responseEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (activeSession) {
      setSessionId(activeSession.id);
      setMessages(activeSession.messages || []);
      setModel(activeSession.model || model);
    } else {
      setSessionId(null);
      setMessages([]);
      setPrompt("");
      setCurrentResponse("");
      setAttachedImage(null);
      setAttachedImagePreview(null);
      if (isGenerating && abortController) {
        abortController.abort();
        setIsGenerating(false);
        setAbortController(null);
      }
    }
    // A modellállapot szándékosan nem része a függőségeknek.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, newChatTrigger]);

  useEffect(() => {
    responseEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentResponse, messages]);

  useEffect(() => {
    if (!isGenerating && textareaRef.current) textareaRef.current.focus();
  }, [isGenerating]);

  useEffect(() => {
    const fetchLLMModels = async () => {
      try {
        const res = await fetch("http://localhost:11434/api/tags");
        if (res.ok) {
          const data = await res.json();
          setAvailableModels(data.models || []);
          if (data.models?.length && !activeSession) setModel(data.models[0].name);
        } else {
          setAvailableModels([]);
        }
      } catch (error) {
        console.error("Az Ollama modellek lekérése nem sikerült:", error);
        setAvailableModels([]);
      }
    };

    const fetchImageModels = async () => {
      try {
        const res = await fetch("http://localhost:8000/image-models");
        if (res.ok) {
          const data = await res.json();
          setAvailableImageModels(data.models || []);
          if (data.models?.length) setImageModel(data.models[0]);
          else setImageModel("Nincs elérhető modell");
        } else {
          setImageModel("Nem érhető el");
        }
      } catch (error) {
        console.error("A képgeneráló modellek lekérése nem sikerült:", error);
        setImageModel("Nincs kapcsolat");
      }
    };

    fetchLLMModels();
    fetchImageModels();
  }, [activeSession]);

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        window.alert("Kérlek, képfájlt válassz.");
        return;
      }
      setAttachedImage(file);
      setAttachedImagePreview(URL.createObjectURL(file));
      setIsImageMode(true);
    }
    event.target.value = "";
  };

  const removeAttachedImage = () => {
    if (attachedImagePreview) URL.revokeObjectURL(attachedImagePreview);
    setAttachedImage(null);
    setAttachedImagePreview(null);
  };

  useEffect(() => {
    return () => {
      if (attachedImagePreview) URL.revokeObjectURL(attachedImagePreview);
    };
  }, [attachedImagePreview]);

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if ((!prompt.trim() && !attachedImage) || isGenerating) return;

    const userQuery = prompt.trim() || "Alakítsd át ezt a képet";
    setPrompt("");
    const currentImage = attachedImage;
    const currentPreview = attachedImagePreview;

    setAttachedImage(null);
    setAttachedImagePreview(null);

    const newMessages = [...messages, {
      role: "user",
      content: userQuery,
      imageUrl: currentPreview,
    }];

    setMessages(newMessages);
    setIsGenerating(true);
    setCurrentResponse("");

    const controller = new AbortController();
    setAbortController(controller);

    if (isImageMode || currentImage) {
      try {
        const formData = new FormData();
        formData.append("prompt", userQuery);
        formData.append("model_name", imageModel);
        if (currentImage) formData.append("image", currentImage);

        const res = await fetch("http://localhost:8000/generate-image", {
          method: "POST",
          signal: controller.signal,
          body: formData,
        });

        if (!res.ok) throw new Error(`Képgenerálási hiba: HTTP ${res.status}`);
        const data = await res.json();

        setMessages((previous) => [...previous, {
          role: "assistant",
          content: `Elkészült a kép a következő kéréshez: *"${userQuery}"*\n\n*Modell: ${imageModel}*`,
          imageUrl: data.image_base64,
        }]);
      } catch (error) {
        if (error.name === "AbortError") {
          setMessages((previous) => [...previous, {
            role: "assistant",
            content: "A képgenerálás megszakadt.",
          }]);
        } else {
          console.error(error);
          setMessages((previous) => [...previous, {
            role: "assistant",
            content: "Hiba történt a képgenerálás során. Ellenőrizd, hogy a ComfyUI fut-e, és a kiválasztott modell elérhető-e.",
          }]);
        }
      } finally {
        setIsGenerating(false);
        setAbortController(null);
        onChatUpdated?.();
      }
      return;
    }

    if (availableModels.length === 0) {
      setMessages((previous) => [...previous, {
        role: "assistant",
        content: "Nem található elérhető Ollama modell. Indítsd el az Ollamát, majd frissítsd az oldalt.",
      }]);
      setIsGenerating(false);
      setAbortController(null);
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          session_id: sessionId,
          model,
          messages: newMessages,
          temperature: 0.7,
        }),
      });

      if (!res.ok) throw new Error(`Chat API hiba: HTTP ${res.status}`);
      if (!res.body) throw new Error("A szerver nem adott válaszfolyamot.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let fullText = "";
      let finalMetrics = null;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.session_id && !sessionId) setSessionId(data.session_id);
              if (data.metrics) finalMetrics = data.metrics;
              if (data.response) {
                fullText += data.response;
                setCurrentResponse(fullText);
              }
            } catch (error) {
              console.warn("Nem feldolgozható stream üzenet:", error);
            }
          }
        }
      }

      if (buffer.startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.slice(6));
          if (data.session_id && !sessionId) setSessionId(data.session_id);
          if (data.metrics) finalMetrics = data.metrics;
          if (data.response) fullText += data.response;
        } catch { /* A stream utolsó sora lehet üres vagy hiányos. */ }
      }

      setMessages((previous) => [...previous, {
        role: "assistant",
        content: fullText,
        metrics: finalMetrics,
      }]);
      setCurrentResponse("");
    } catch (error) {
      if (error.name === "AbortError") {
        setMessages((previous) => [...previous, {
          role: "assistant",
          content: "A válaszgenerálás megszakadt.",
        }]);
      } else {
        console.error(error);
        setMessages((previous) => [...previous, {
          role: "assistant",
          content: "Nem sikerült elérni a chat API-t. Ellenőrizd, hogy fut-e a FastAPI backend.",
        }]);
      }
      setCurrentResponse("");
    } finally {
      setIsGenerating(false);
      setAbortController(null);
      onChatUpdated?.();
    }
  };

  const formatMetric = (value, digits = 1) =>
    Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

  return (
    <section className={`panel chat-panel ${isImageMode ? "chat-image-mode" : ""}`}>
      {selectedImage && (
        <div className="image-lightbox" onClick={() => setSelectedImage(null)}>
          <button type="button" className="lightbox-close" onClick={() => setSelectedImage(null)} aria-label="Bezárás">
            <X size={19} />
          </button>
          <img src={selectedImage} alt="Nagyított kép" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      <header className="chat-header">
        <div className="chat-heading">
          <div className="chat-brand-icon"><Sparkles size={17} /></div>
          <div>
            <h1>LocalAI Studio</h1>
            <p><span className="status-dot" /> Privát, helyi AI-munkaterület</p>
          </div>
        </div>

        <div className="chat-model-controls">
          <div className="model-select-wrap">
            <button
              type="button"
              className={`model-select image-model-select ${isImageDropdownOpen ? "select-open" : ""}`}
              onClick={() => {
                setIsImageDropdownOpen((open) => !open);
                setIsDropdownOpen(false);
              }}
              title="Képgeneráló modell"
            >
              <ImageIcon size={14} />
              <span>{imageModel}</span>
              <ChevronDown size={14} />
            </button>
            {isImageDropdownOpen && (
              <div className="model-menu">
                <div className="model-menu-heading">ComfyUI modellek</div>
                <div className="model-menu-list">
                  {availableImageModels.length === 0 ? (
                    <div className="model-empty">Nem található elérhető képgeneráló modell.</div>
                  ) : availableImageModels.map((item, index) => (
                    <button
                      type="button"
                      key={`${item}-${index}`}
                      className={imageModel === item ? "model-option selected" : "model-option"}
                      onClick={() => {
                        setImageModel(item);
                        setIsImageDropdownOpen(false);
                      }}
                    >
                      <span className="model-option-dot" />{item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="model-select-wrap">
            <button
              type="button"
              className={`model-select ${isDropdownOpen ? "select-open" : ""}`}
              onClick={() => {
                setIsDropdownOpen((open) => !open);
                setIsImageDropdownOpen(false);
              }}
              title="Szöveggeneráló modell"
            >
              <span className={`model-status-dot ${availableModels.length ? "online" : ""}`} />
              <span>{model}</span>
              <ChevronDown size={14} />
            </button>
            {isDropdownOpen && (
              <div className="model-menu">
                <div className="model-menu-heading">Ollama modellek</div>
                <div className="model-menu-list">
                  {availableModels.length === 0 ? (
                    <div className="model-empty">Nem található futtatható modell.</div>
                  ) : availableModels.map((item) => (
                    <button
                      type="button"
                      key={item.name}
                      className={model === item.name ? "model-option selected" : "model-option"}
                      onClick={() => {
                        setModel(item.name);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <span className="model-option-dot" />{item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {messages.length === 0 && !isGenerating ? (
        <div className="chat-welcome">
          <div className="welcome-symbol"><Sparkles size={27} /></div>
          <span className="welcome-eyebrow">LOCAL AI WORKSPACE</span>
          <h2>Miben segíthetek?</h2>
          <p>Kérdezz, tervezz, írj kódot vagy dolgozz fel egy képet. A feldolgozás a saját gépeden fut.</p>
          <div className="welcome-chips">
            <span><Bot size={13} /> Helyi AI-modellek</span>
            <span><WandSparkles size={13} /> Képgenerálás</span>
            <span><Zap size={13} /> Valós idejű válasz</span>
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message-row ${message.role === "user" ? "user-message-row" : "assistant-message-row"}`}>
              <div className={`message-avatar ${message.role === "user" ? "user-avatar" : "assistant-avatar"}`}>
                {message.role === "user" ? <UserRound size={15} /> : <Sparkles size={15} />}
              </div>
              <div className={`message-content ${message.role === "user" ? "user-message" : "assistant-message"}`}>
                {message.role === "user" && message.imageUrl && (
                  <img
                    src={message.imageUrl}
                    alt="Feltöltött kép"
                    className="message-image user-upload-image"
                    onClick={() => setSelectedImage(message.imageUrl)}
                  />
                )}
                {message.role === "user" ? (
                  <div className="message-text">{message.content}</div>
                ) : (
                  <>
                    <div className="markdown-body">
                      <ReactMarkdown components={{ code: CodeBlock }}>{message.content}</ReactMarkdown>
                    </div>
                    {message.imageUrl && (
                      <img
                        src={message.imageUrl}
                        alt="Generált kép"
                        className="message-image generated-image"
                        onClick={() => setSelectedImage(message.imageUrl)}
                        title="Kattints a nagyításhoz"
                      />
                    )}
                    {message.metrics && (
                      <div className="message-metrics">
                        <span><Zap size={11} /> {formatMetric(message.metrics.tps)} tok/s</span>
                        <span><Clock size={11} /> {formatMetric(Number(message.metrics.latency_ms) / 1000, 2)} s</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="message-row assistant-message-row">
              <div className="message-avatar assistant-avatar"><Sparkles size={15} /></div>
              <div className="message-content assistant-message">
                <div className="markdown-body">
                  {currentResponse ? (
                    <ReactMarkdown components={{ code: CodeBlock }}>{currentResponse}</ReactMarkdown>
                  ) : (
                    <div className="thinking-indicator"><span /><span /><span /> Gondolkodom</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={responseEndRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-composer">
        {attachedImagePreview && (
          <div className="attachment-preview">
            <img src={attachedImagePreview} alt="Csatolt kép előnézete" />
            <div className="attachment-info">
              <strong>{attachedImage?.name}</strong>
              <span>Kép csatolva, Img2Img mód</span>
            </div>
            <button type="button" onClick={removeAttachedImage} aria-label="Kép eltávolítása">
              <X size={15} />
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={2}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={isImageMode ? "Írd le, hogyan módosítsa a képet…" : "Írj üzenetet a LocalAI-nak…"}
          className="chat-textarea"
          disabled={isGenerating}
        />

        <div className="composer-toolbar">
          <div className="composer-tools">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              className="composer-tool-button"
              onClick={() => fileInputRef.current?.click()}
              title="Kép csatolása"
            >
              <Paperclip size={15} /><span>Csatolás</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImageMode((enabled) => !enabled)}
              className={`image-mode-toggle ${isImageMode ? "active" : ""}`}
              title="Képgeneráló mód kapcsolása"
            >
              <ImageIcon size={14} />
              <span>Képgenerálás</span>
              <span className="toggle-state">{isImageMode ? "BE" : "KI"}</span>
            </button>
          </div>

          <div className="composer-submit-wrap">
            <span className="composer-hint">Enter küldés · Shift + Enter új sor</span>
            {isGenerating ? (
              <button type="button" onClick={handleStop} className="send-button stop-button" title="Generálás leállítása">
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim() && !attachedImage}
                className="send-button"
                title="Üzenet küldése"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
      </form>
      <div className="chat-bottom-note">A válaszok helyi modellel készülnek. <span>Az adataid nálad maradnak.</span></div>
    </section>
  );
}

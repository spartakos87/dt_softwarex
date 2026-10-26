import { API_BASE } from "../config";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// icon URL
const iconUrl = '/ai_assistant.png';

// 1. Create ChatContext
const ChatContext = createContext({
  open: false,
  messages: [],
  addMessage: () => { },
  toggleOpen: () => { }
});

// 2. ChatProvider wraps the app, persists history
export function ChatProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('chatLog')) || [];
    } catch { return []; }
  });

  useEffect(() => {
    sessionStorage.setItem('chatLog', JSON.stringify(messages));
  }, [messages]);

  const addMessage = msg => setMessages(prev => [...prev, msg]);
  const clearMessages = () => setMessages([]);
  const toggleOpen = () => setOpen(o => !o);

  return (
    <ChatContext.Provider value={{ open, messages, addMessage, clearMessages, toggleOpen }}>
      {children}
    </ChatContext.Provider>
  );
}

// 3. Hook for chat context
export const useChat = () => useContext(ChatContext);

// 4. ChatWidget: Draggable floating button + chat panel
export default function ChatWidget() {
  const { open, messages, addMessage, clearMessages, toggleOpen } = useChat();
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Draggable position state
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - 80,
    y: window.innerHeight - window.innerHeight * 0.07 - 80
  }));
  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });

  // Handlers
  const onMouseDown = e => {
    dragging.current = true;
    moved.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    offset.current = { ...pos };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = e => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setPos({ x: offset.current.x + dx, y: offset.current.y + dy });
  };

  const onMouseUp = () => {
    dragging.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  const handleClick = () => {
    if (moved.current) {
      moved.current = false;
      return; // prevent open after drag
    }
    toggleOpen();
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    addMessage({ role: 'user', text, timestamp: Date.now() });
    setInput('');
    setLoading(true);

    try {
      const token = sessionStorage.getItem("token");
      const resp = await fetch(`${API_BASE}/getAIResponse`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const reply = data.response || 'Error fetching reply';
      addMessage({ role: 'assistant', text: reply, timestamp: Date.now() });
    } catch (err) {
      console.error(err);
      addMessage({ role: 'assistant', text: 'Network error', timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  };

  // Panel positioning relative to button
  const panelWidth = 320;
  const panelHeight = 400;
  let panelStyle = { position: 'fixed', width: panelWidth, height: panelHeight, background: '#fff', border: '1px solid #ddd', borderRadius: 8, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000 };
  // default above-left of button
  const left = pos.x;
  const top = pos.y - panelHeight - 16;
  // adjust if off-screen
  panelStyle.left = left + panelWidth > window.innerWidth ? window.innerWidth - panelWidth - 16 : left;
  panelStyle.top = top < 16 ? pos.y + 56 + 16 : top;

  return (
    <>
      {/* Draggable AI button */}
      <button
        aria-label="Open AI assistant"
        onClick={handleClick}
        onMouseDown={onMouseDown}
        style={{
          position: 'fixed',
          top: pos.y,
          left: pos.x,
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundImage: `url(${iconUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: 'white',
          border: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          cursor: dragging.current ? 'grabbing' : 'grab',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none'
        }}
      />

      {/* Chat panel */}
      {open && (
        <div style={panelStyle} onClick={() => setShowMenu(false)}>
          {/* Header */}
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <strong>AI Assistant</strong>
            <button onClick={() => setShowMenu(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} >
              {/* Three dots icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3 9.5A1.5 1.5 0 1 1 3 6.5a1.5 1.5 0 0 1 0 3zm5 0A1.5 1.5 0 1 1 8 6.5a1.5 1.5 0 0 1 0 3zm5 0A1.5 1.5 0 1 1 13 6.5a1.5 1.5 0 0 1 0 3z" />
              </svg>
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: '2.5rem', right: '0.5rem', background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                <button onClick={() => { clearMessages(); setShowMenu(false); }} style={{ border: 'none', borderBottom: '1px solid #ccc', display: 'block', padding: '0.5rem 1rem', width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer' }}>Clear</button>
                <button onClick={() => { toggleOpen(); setShowMenu(false); }} style={{ border: 'none', borderBottom: '1px solid #ccc', display: 'block', padding: '0.5rem 1rem', width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer' }}>Close</button>
              </div>
            )}
          </div>

          {/* Message list */}
          <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', fontSize: '0.9rem', lineHeight: 1.4 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: '0.5rem', textAlign: m.role === 'user' ? 'right' : 'left' }}>
                <span style={{ background: m.role === 'user' ? '#e0f7fa' : '#f1f1f1', padding: '0.4rem 0.6rem', borderRadius: '6px', display: 'inline-block' }}>
                  {m.text}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input box */}
          <div style={{ borderTop: '1px solid #eee', padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button onClick={send} style={{ padding: '0.5rem 0.75rem', border: 'none', borderRadius: '4px', background: '#2980b9', color: '#fff', cursor: 'pointer' }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

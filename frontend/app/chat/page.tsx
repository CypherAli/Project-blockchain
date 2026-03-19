'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { shortAddress, timeAgo } from '@/lib/contracts';

interface Message {
  id: string;
  author: string;
  text: string;
  ts: number;
  role?: 'system';
}

const SEED_MSGS: Message[] = [
  { id: '1', author: '0xA1b2C3d4E5f678901234567890AbCdEf', text: 'just bought 5 shares of Mona Lisa 🔥', ts: Date.now() / 1000 - 480 },
  { id: '2', author: '0xB2c3D4e5F67890123456789012345BcD', text: 'starry night is gonna graduate soon, looks bullish', ts: Date.now() / 1000 - 360 },
  { id: '3', author: '0xC3d4E5f6789012345678901234abcDE', text: 'gm everyone', ts: Date.now() / 1000 - 300 },
  { id: '4', author: '0xD4e5F678901234567890123456AbcD1', text: 'what does the bonding curve actually mean for price?', ts: Date.now() / 1000 - 240 },
  { id: '5', author: '0xE5f6789012345678901234567890123', text: 'it means as more shares are bought, price goes up linearly. sell pressure brings it back down', ts: Date.now() / 1000 - 200 },
  { id: '6', author: '0xA1b2C3d4E5f678901234567890AbCdEf', text: 'The Kiss by Klimt is so undervalued rn', ts: Date.now() / 1000 - 120 },
  { id: '7', author: '0xF6789012345678901234567890abcde1', text: 'anyone know when new artworks drop?', ts: Date.now() / 1000 - 60 },
  { id: '8', author: '0x0000000000000000000000000000000000000001', text: '🎓 Mona Lisa has graduated to DEX trading!', ts: Date.now() / 1000 - 20, role: 'system' },
];

const ROOMS = [
  { id: 'global', label: '# general' },
  { id: 'trading', label: '# trading' },
  { id: 'artists', label: '# artists' },
  { id: 'announcements', label: '📢 announcements' },
];

export default function ChatPage() {
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<Message[]>(SEED_MSGS);
  const [input, setInput] = useState('');
  const [room, setRoom] = useState('global');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !address) return;
    const msg: Message = {
      id: `${Date.now()}`,
      author: address,
      text: input.trim(),
      ts: Math.floor(Date.now() / 1000),
    };
    setMessages(prev => [...prev, msg]);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 140px)', minHeight: 500 }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
          Community Chat
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Talk with collectors and artists
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* Sidebar: rooms */}
        <div style={{
          width: 180, flexShrink: 0, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, padding: '0 8px' }}>
            Channels
          </div>
          {ROOMS.map(r => (
            <button key={r.id} onClick={() => setRoom(r.id)} style={{
              textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--r-sm)',
              background: room === r.id ? 'var(--surface-2)' : 'transparent',
              color: room === r.id ? 'var(--text)' : 'var(--text-muted)',
              border: `1px solid ${room === r.id ? 'var(--border-hover)' : 'transparent'}`,
              fontFamily: 'var(--font-sans)', fontSize: 13, cursor: 'pointer',
              transition: 'all 0.12s',
            }}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Messages */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg) var(--r-lg) 0 0', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '6px 8px', borderRadius: 'var(--r-sm)',
                background: msg.role === 'system' ? 'hsl(42 72% 48% / 0.07)' : 'transparent',
                border: msg.role === 'system' ? '1px solid hsl(42 72% 48% / 0.2)' : '1px solid transparent',
              }}>
                {/* Avatar */}
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                  background: msg.role === 'system'
                    ? 'hsl(42 72% 48% / 0.3)'
                    : `hsl(${parseInt(msg.author.slice(2, 8), 16) % 360} 56% 36% / 0.5)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)',
                  border: '1px solid var(--border)',
                }}>
                  {msg.role === 'system' ? '📢' : msg.author.slice(2, 4).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: msg.role === 'system' ? 'var(--gold)' : (msg.author === address ? 'var(--green)' : 'var(--teal)'), fontWeight: 600 }}>
                      {msg.role === 'system' ? 'ArtCurve' : shortAddress(msg.author as `0x${string}`, 6)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                      {timeAgo(Math.floor(msg.ts))}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: msg.role === 'system' ? 'var(--gold)' : 'var(--text)', lineHeight: 1.5 }}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderTop: 'none', borderRadius: '0 0 var(--r-lg) var(--r-lg)',
            padding: '10px 12px',
          }}>
            {isConnected ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={`Message #${room}...`}
                  style={{
                    flex: 1, background: 'var(--surface-3)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                    padding: '9px 14px', color: 'var(--text)',
                    fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none',
                  }}
                />
                <button onClick={handleSend} disabled={!input.trim()} style={{
                  padding: '9px 18px', background: 'var(--green)',
                  color: 'hsl(135 28% 8%)', border: 'none',
                  borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  opacity: input.trim() ? 1 : 0.4,
                }}>
                  send
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  Connect wallet to chat
                </span>
                <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

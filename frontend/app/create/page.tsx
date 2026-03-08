'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useCreateArtwork, useListingFee } from '@/lib/hooks';
import { uploadImageToIPFS, uploadMetadataToIPFS } from '@/lib/ipfs';
import { formatEth } from '@/lib/contracts';
import { usePublicClient } from 'wagmi';
import Link from 'next/link';

export default function CreatePage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const client = usePublicClient();

  const [name,            setName]       = useState('');
  const [description, setDescription]   = useState('');
  const [imageFile,    setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview]  = useState<string>('');
  const [step,         setStep]          = useState<'form' | 'uploading' | 'deploying' | 'done'>('form');
  const [statusMsg,    setStatusMsg]     = useState('');
  const [deployedAddr, setDeployedAddr]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: listingFeeData } = useListingFee();
  const listingFee: bigint = (listingFeeData as bigint | undefined) ?? BigInt('10000000000000000');

  const { create, hash, isPending, isConfirming, isSuccess } = useCreateArtwork();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!name || !imageFile || !isConnected || !address) return;
    try {
      setStep('uploading');
      setStatusMsg('uploading artwork image to IPFS...');
      const imageCID = await uploadImageToIPFS(imageFile);
      setStatusMsg('uploading metadata to IPFS...');
      const metadataCID = await uploadMetadataToIPFS({
        name, description, artist: address,
        image: `ipfs://${imageCID}`,
        createdAt: new Date().toISOString(),
      });
      setStep('deploying');
      setStatusMsg('deploying bonding curve contract...');
      create(name, metadataCID, listingFee);
    } catch (err: any) {
      setStep('form');
      alert(`error: ${err.message}`);
    }
  };

  if (isSuccess && hash && step === 'deploying' && !deployedAddr) {
    client?.waitForTransactionReceipt({ hash }).then((receipt) => {
      const factoryLog = receipt.logs.find((log) => log.topics.length > 0);
      if (factoryLog) {
        const contractAddr = `0x${factoryLog.topics[1]?.slice(26)}`;
        if (contractAddr && contractAddr !== '0x') {
          setDeployedAddr(contractAddr);
          setStep('done');
        }
      }
    });
  }

  // ── Not connected ─────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🌱</div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 10 }}>
          [launch your artwork]
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
          connect wallet to deploy a bonding curve for your art
        </p>
        <ConnectButton />
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--green)', margin: 0, marginBottom: 10 }}>
          [artwork launched!]
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          bonding curve is live. share with collectors and start earning royalties.
        </p>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>contract address</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', wordBreak: 'break-all' }}>{deployedAddr}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => router.push(`/artwork/${deployedAddr}`)} className="btn"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, padding: '9px 20px', cursor: 'pointer' }}
          >
            [view artwork]
          </button>
          <button
            onClick={() => { setStep('form'); setName(''); setDescription(''); setImageFile(null); setImagePreview(''); setDeployedAddr(''); }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '9px 20px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            [launch another]
          </button>
        </div>
      </div>
    );
  }

  // ── Uploading / Deploying ─────────────────────────────────────────────────

  if (step === 'uploading' || step === 'deploying') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>
          {step === 'uploading' ? '📤' : '⛓️'}
        </div>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 8 }}>
          {step === 'uploading' ? 'uploading to IPFS...' : 'deploying to blockchain...'}
        </h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{statusMsg}</p>
        {step === 'deploying' && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', marginTop: 12 }}>
            {isPending && '[waiting for wallet signature...]'}
            {isConfirming && '[confirming transaction...]'}
          </p>
        )}
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
          [start a new artwork]
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          your art gets its own bonding curve — price rises with every buy, you earn 5% royalty on every trade forever.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Image upload */}
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              aspectRatio: '1', borderRadius: 'var(--r-lg)',
              border: `2px dashed ${imagePreview ? 'var(--border-hover)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
              background: 'var(--surface)', cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = imagePreview ? 'var(--border-hover)' : 'var(--border)')}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>[change image]</span>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>click to upload artwork</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4, opacity: 0.6 }}>PNG · JPG · GIF · WebP · SVG</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
          {imageFile && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {imageFile.name}
            </div>
          )}
        </div>

        {/* Form fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
              artwork name *
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunset Over Hanoi" maxLength={50}
              style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.15s' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
              description <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="tell the story behind this artwork..." rows={3}
              style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.15s' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Curve info */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              bonding curve settings
            </div>
            {[
              { label: 'starting price',  value: '0.001 ETH/share',  color: 'var(--text)' },
              { label: 'slope (k)',        value: '0.0001 ETH/share²', color: 'var(--text)' },
              { label: 'artist royalty',  value: '5% every trade',   color: 'var(--gold)' },
              { label: 'graduation at',   value: '24 ETH reserve',   color: 'var(--text)' },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Listing fee */}
          <div style={{ background: 'hsl(135 56% 54% / 0.07)', border: '1px solid hsl(135 56% 54% / 0.25)', borderRadius: 'var(--r-md)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>listing fee (one-time)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{formatEth(listingFee, 4)} ETH</span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!name || !imageFile}
            className="btn"
            style={{ width: '100%', padding: '13px 0', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, opacity: (!name || !imageFile) ? 0.35 : 1, cursor: (!name || !imageFile) ? 'not-allowed' : 'pointer' }}
          >
            {!name || !imageFile ? '[fill in name and image first]' : '[deploy bonding curve →]'}
          </button>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            artwork stored permanently on IPFS · contract deployed to EVM blockchain
          </p>
        </div>
      </div>
    </div>
  );
}

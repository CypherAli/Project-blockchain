"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useCreateArtwork, useListingFee } from "@/lib/hooks";
import { uploadImageToIPFS, uploadMetadataToIPFS } from "@/lib/ipfs";
import { formatEth } from "@/lib/contracts";
import { usePublicClient } from "wagmi";

export default function CreatePage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const client = usePublicClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [step, setStep] = useState<"form" | "uploading" | "deploying" | "done">("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [deployedAddress, setDeployedAddress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: listingFeeData } = useListingFee();
  const listingFee: bigint = (listingFeeData as bigint | undefined) ?? BigInt("10000000000000000");

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
    if (!name || !imageFile) return;
    if (!isConnected || !address) return;
    try {
      setStep("uploading");
      setStatusMsg("uploading artwork image to IPFS...");
      const imageCID = await uploadImageToIPFS(imageFile);
      setStatusMsg("uploading metadata to IPFS...");
      const metadataCID = await uploadMetadataToIPFS({
        name, description, artist: address,
        image: `ipfs://${imageCID}`,
      });
      setStep("deploying");
      setStatusMsg("deploying bonding curve contract...");
      create(name, metadataCID, listingFee);
    } catch (err: any) {
      setStep("form");
      alert(`error: ${err.message}`);
    }
  };

  if (isSuccess && hash && step === "deploying" && !deployedAddress) {
    client?.waitForTransactionReceipt({ hash }).then((receipt) => {
      const factoryLog = receipt.logs.find((log) => log.topics.length > 0);
      if (factoryLog) {
        const contractAddr = `0x${factoryLog.topics[1]?.slice(26)}`;
        if (contractAddr && contractAddr !== "0x") {
          setDeployedAddress(contractAddr);
          setStep("done");
        }
      }
    });
  }

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto text-center py-20 font-mono">
        <p className="text-5xl mb-6">🎨</p>
        <h1 className="text-xl font-black text-white mb-3">[launch your artwork]</h1>
        <p className="text-[#555] mb-8 text-sm">
          connect wallet to deploy a bonding curve for your art
        </p>
        <ConnectButton />
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="max-w-md mx-auto text-center py-16 font-mono">
        <div className="text-5xl mb-6">🚀</div>
        <h1 className="text-xl font-black text-[#00ff88] mb-3">[artwork launched!]</h1>
        <p className="text-[#555] text-sm mb-6">
          bonding curve is live. share with collectors and start earning royalties.
        </p>
        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-4 mb-6 text-left">
          <p className="text-[#444] text-[11px] mb-1">contract address</p>
          <p className="text-[#00ff88] text-xs break-all">{deployedAddress}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/artwork/${deployedAddress}`)}
            className="px-5 py-2 bg-[#00ff88] text-black font-black text-xs rounded hover:bg-[#00cc6a] transition-all"
          >
            [view artwork]
          </button>
          <button
            onClick={() => {
              setStep("form"); setName(""); setDescription("");
              setImageFile(null); setImagePreview(""); setDeployedAddress("");
            }}
            className="px-5 py-2 bg-[#1a1a1a] text-[#888] text-xs rounded border border-[#2a2a2a] hover:text-white transition-all"
          >
            [launch another]
          </button>
        </div>
      </div>
    );
  }

  if (step === "uploading" || step === "deploying") {
    return (
      <div className="max-w-md mx-auto text-center py-20 font-mono">
        <div className="text-4xl mb-6 animate-bounce">
          {step === "uploading" ? "📤" : "⛓️"}
        </div>
        <h2 className="text-sm font-bold text-white mb-2">
          {step === "uploading" ? "uploading to IPFS..." : "deploying to blockchain..."}
        </h2>
        <p className="text-[#444] text-xs">{statusMsg}</p>
        {step === "deploying" && (
          <p className="text-[#00ff88] text-xs mt-3">
            {isPending && "[waiting for wallet signature...]"}
            {isConfirming && "[confirming transaction...]"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto font-mono">
      {/* Header — pump.fun style */}
      <div className="mb-6 pb-4 border-b border-[#1e1e1e]">
        <h1 className="text-white font-black text-xl mb-1">[start a new artwork]</h1>
        <p className="text-[#444] text-xs">
          your art gets its own bonding curve. price rises with every buy. you earn 5% royalty on every trade — forever.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Image upload */}
        <div>
          <div
            className="aspect-square rounded-lg border-2 border-dashed border-[#2a2a2a] hover:border-[#00ff88]/40 transition-colors cursor-pointer flex items-center justify-center overflow-hidden relative bg-[#0d0d0d]"
            onClick={() => fileRef.current?.click()}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-[#333] p-6">
                <p className="text-4xl mb-3">🖼️</p>
                <p className="text-xs text-[#444]">click to upload artwork</p>
                <p className="text-[10px] mt-1 text-[#333]">PNG, JPG, GIF, WebP, SVG</p>
              </div>
            )}
            {imagePreview && (
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-[#00ff88] text-xs">[change image]</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          {imageFile && (
            <p className="text-[10px] text-[#333] mt-1.5 text-center truncate">{imageFile.name}</p>
          )}
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-[#444] block mb-1.5">artwork name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunset Over Hanoi"
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00ff88]/50 transition-colors"
              maxLength={50}
            />
          </div>

          <div>
            <label className="text-[11px] text-[#444] block mb-1.5">description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="tell the story behind this artwork..."
              rows={3}
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00ff88]/50 transition-colors resize-none"
            />
          </div>

          {/* Curve params — pump.fun info box */}
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded p-3 text-[11px] space-y-1.5">
            <p className="text-[#555] mb-2">bonding curve settings</p>
            <div className="flex justify-between text-[#444]">
              <span>starting price</span>
              <span className="text-white">0.001 ETH/share</span>
            </div>
            <div className="flex justify-between text-[#444]">
              <span>slope (k)</span>
              <span className="text-white">0.0001 ETH/share²</span>
            </div>
            <div className="flex justify-between text-[#444]">
              <span>artist royalty</span>
              <span className="text-yellow-400">5% every trade</span>
            </div>
            <div className="flex justify-between text-[#444]">
              <span>graduation at</span>
              <span className="text-white">24 ETH reserve</span>
            </div>
          </div>

          {/* Listing fee */}
          <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded p-2.5 text-[11px] flex justify-between">
            <span className="text-[#555]">listing fee (one-time)</span>
            <span className="text-[#00ff88] font-bold">{formatEth(listingFee, 4)} ETH</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!name || !imageFile}
            className="w-full py-3 bg-[#00ff88] hover:bg-[#00cc6a] disabled:opacity-30 disabled:cursor-not-allowed text-black font-black text-sm rounded transition-all"
          >
            {!name || !imageFile ? "[fill in name and image first]" : "[deploy bonding curve →]"}
          </button>
          <p className="text-[10px] text-[#333] text-center">
            artwork stored permanently on IPFS · contract deployed to EVM blockchain
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import debounce from "lodash.debounce";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [expiry, setExpiry] = useState("1h");
  const [activeUsers, setActiveUsers] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Modal State
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinInput, setJoinInput] = useState("");

  // Fetch initial data on load
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("content")
        .eq("id", roomId)
        .single();

      if (data) {
        setText(data.content);
      } else {
        const hours = expiry === "1h" ? 1 : expiry === "3h" ? 3 : 6;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + hours);

        await supabase
          .from("rooms")
          .insert([
            { id: roomId, content: "", expires_at: expiresAt.toISOString() },
          ]);
      }
    };
    fetchInitialData();
  }, [roomId, expiry]);

  // Set up Realtime Subscriptions
  useEffect(() => {
    const channel = supabase.channel(`room_${roomId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          setText(payload.new.content);
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setActiveUsers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Debounced Database Update
  const updateDatabase = useCallback(
    debounce(async (newContent) => {
      setIsSyncing(true);
      await supabase
        .from("rooms")
        .update({ content: newContent })
        .eq("id", roomId);
      setIsSyncing(false);
    }, 500),
    [roomId],
  );

  const handleTextChange = (content) => {
    setText(content);
    if (autoSave) {
      updateDatabase(content);
    }
  };

  const handleManualSave = () => {
    updateDatabase(text);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomId);
    // alert(`Room ID ${roomId} copied to clipboard!`);
  };

  // Navigation Handlers
  const handleCreateNewRoom = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomId = "";
    for (let i = 0; i < 6; i++) {
      randomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    navigate(`/room/${randomId}`);
  };

  const handleJoinRoom = () => setIsJoinModalOpen(true);
  const executeJoin = () => {
    if (joinInput.trim().length > 0) {
      navigate(`/room/${joinInput.trim().toUpperCase()}`);
      setIsJoinModalOpen(false);
      setJoinInput("");
    }
  };

  // File Uploads
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check size (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large! Maximum size is 5MB.");
      return;
    }

    setIsUploading(true);

    try {
      // Create a unique filename so files don't overwrite each other
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${roomId}/${fileName}`;

      // Upload to Supabase 'room-files' bucket
      const { error } = await supabase.storage
        .from("room-files")
        .upload(filePath, file);

      if (error) throw error;

      // Get the public download URL
      const { data: publicUrlData } = supabase.storage
        .from("room-files")
        .getPublicUrl(filePath);

      // Create a clickable HTML link for React Quill
      const fileLink = `<p><br> <a href="${publicUrlData.publicUrl}" target="_blank" rel="noopener noreferrer" style="color: #A875FF; text-decoration: underline;"><strong>${file.name}</strong></a><br></p>`;
      const newText = text + fileLink;

      setText(newText);
      updateDatabase(newText);
    } catch (error) {
      alert("Error uploading file: " + error.message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans flex flex-col overflow-x-hidden">
      {/* Top Navigation Bar */}
      <nav className="flex flex-col sm:flex-row flex-wrap items-center justify-between px-4 lg:px-8 py-4 bg-white border-b border-gray-200 gap-4">
        {/* Logo & Room ID container */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-16 w-full sm:w-auto justify-between sm:justify-start">
          <div
            onClick={handleCreateNewRoom}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="bg-[#1E1E2E] text-white p-2 rounded-xl flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-800">
              Sync<span className="text-[#A875FF]">Space</span>
            </span>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-sm">
            <span className="text-gray-500 font-medium hidden sm:inline">
              Room ID:
            </span>
            <span className="font-bold tracking-wider">{roomId}</span>
            <button
              onClick={handleCopyLink}
              className="cursor-pointer text-gray-400 hover:text-gray-600 ml-1 transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Action Buttons Container */}
        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3 text-sm font-medium w-full sm:w-auto">
          <button
            onClick={handleCreateNewRoom}
            className="cursor-pointer flex items-center gap-1 sm:gap-2 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors text-xs sm:text-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span className="hidden sm:inline">Create New Room</span>
            <span className="sm:hidden">New</span>
          </button>

          <button
            onClick={handleJoinRoom}
            className="cursor-pointer flex items-center gap-1 sm:gap-2 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors text-xs sm:text-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span className="hidden sm:inline">Join Room</span>
            <span className="sm:hidden">Join</span>
          </button>

          <button
            onClick={handleManualSave}
            className="cursor-pointer flex items-center gap-1 sm:gap-2 px-4 py-2 bg-[#5F6368] hover:bg-[#4a4d51] text-white rounded-xl transition-colors text-xs sm:text-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            {isSyncing ? "Saving.." : "Save"}
          </button>

          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="cursor-pointer flex items-center gap-2 px-2 sm:px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors text-xs sm:text-sm"
          >
            <option value="1h">1 Hour</option>
            <option value="3h">3 Hours</option>
            <option value="6h">6 Hours(Max)</option>
          </select>

          <label className="flex items-center gap-1 sm:gap-2 ml-1">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={() => setAutoSave(!autoSave)}
              className="w-4 h-4 text-[#A875FF] rounded border-gray-300 focus:ring-[#A875FF] accent-[#A875FF] cursor-pointer"
            />
            <span className="text-gray-700 text-xs sm:text-sm hidden sm:inline">
              Auto-Save
            </span>
          </label>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:py-12 flex flex-col items-center">
        <h1 className="text-3xl sm:text-5xl font-bold mb-2 tracking-tight text-gray-900 text-center">
          Hi there, <span className="text-[#A875FF]">Welcome</span>
        </h1>
        <h2 className="text-lg sm:text-2xl font-bold mb-6 sm:mb-10 text-gray-800 text-center">
          What would you like to paste?
        </h2>

        {/* Editor Container */}
        <div className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex items-center gap-2 bg-emerald-50 text-emerald-600 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium border border-emerald-100 z-10">
            <span
              className={`w-2 h-2 rounded-full bg-emerald-500 ${activeUsers > 0 ? "animate-pulse" : ""}`}
            />
            <span className="hidden sm:inline">{activeUsers} Active</span>
            <span className="sm:hidden">{activeUsers}</span>
          </div>

          {/* React Quill Editor */}
          <div className="w-full h-[400px] sm:h-[500px] flex flex-col">
            <ReactQuill
              theme="snow"
              value={text}
              onChange={handleTextChange}
              placeholder="Start typing, pasting, or uploading files..."
              className="flex-1 h-full overflow-hidden [&_.ql-editor]:text-base [&_.ql-editor]:font-sans [&_.ql-editor]:text-gray-700"
            />
          </div>

          {/* Editor Footer */}
          <div className="bg-[#FAFAFA] border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center text-xs sm:text-sm text-gray-500 gap-3">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* The actual button the user clicks */}
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading}
              className={`flex items-center justify-center w-full sm:w-auto gap-2 transition-colors ${isUploading ? "text-[#A875FF] animate-pulse cursor-wait" : "hover:text-gray-800 cursor-pointer"}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
              {isUploading ? "Uploading file..." : "Attach File (Max 5MB)"}
            </button>

            <span className="font-mono text-[10px] sm:text-sm">
              {text === "<p><br></p>" || text === "<p></p>" || text === ""
                ? 0
                : text.length}
              /500000 characters
            </span>
          </div>
        </div>
      </main>

      {/* Join Room Modal Overlay */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 sm:p-8 rounded-2xl w-full max-w-sm shadow-xl relative">
            <button
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Join a Room</h2>
            <p className="text-gray-500 mb-6 text-xs sm:text-sm">
              Enter a 6-digit room code to join and collaborate.
            </p>

            <input
              type="text"
              placeholder="E.G. A1B2C3"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeJoin()}
              className="w-full text-center border-2 border-gray-200 rounded-xl py-3 sm:py-4 font-bold text-base sm:text-lg mb-6 focus:border-[#A875FF] outline-none"
            />

            <button
              onClick={executeJoin}
              className="w-full bg-[#5F6368] hover:bg-[#4a4d51] text-white py-3 rounded-xl font-bold transition-all text-sm sm:text-base"
            >
              Join Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

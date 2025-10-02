import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";

export default function ChatInterface({ chatPartnerId }) {
  const [status, setStatus] = useState("offline");
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (!chatPartnerId || !database) return;

    const statusRef = ref(database, `status/${chatPartnerId}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatus(data.state);
        setLastSeen(data.lastSeen);
      } else {
        setStatus("offline");
        setLastSeen(null);
      }
    });

    return () => unsubscribe();
  }, [chatPartnerId]);

  return (
    <div className="text-sm text-gray-500 px-2 py-1">
      {status === "online"
        ? "🟢 在线"
        : lastSeen
        ? `${Math.floor((Date.now() - lastSeen) / 60000)} 分钟前在线`
        : "⚪ 离线"}
    </div>
  );
}

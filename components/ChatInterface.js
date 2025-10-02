import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { formatDistanceToNow } from "date-fns";

export default function ChatInterface({ chatPartnerId }) {
  const [status, setStatus] = useState("offline");
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (!chatPartnerId || !database) return;

    const statusRef = ref(database, `onlineStatus/${chatPartnerId}`);

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

  const renderStatus = () => {
    if (status === "online") return "🟢 在线";
    if (lastSeen) {
      return `${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })} 在线过`;
    }
    return "⚪ 离线";
  };

  return (
    <div className="text-sm text-gray-500 px-2 py-1">
      {renderStatus()}
    </div>
  );
}

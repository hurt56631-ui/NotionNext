import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtDb } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

// 格式化时间
const formatLastSeen = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "刚刚在线";
  if (minutes < 60) return `${minutes} 分钟前在线`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前在线`;
  const days = Math.floor(hours / 24);
  return `${days} 天前在线`;
};

export default function ChatInterface({ chatPartnerId }) {
  const { user } = useAuth();
  const [partnerStatus, setPartnerStatus] = useState("离线");

  useEffect(() => {
    if (!chatPartnerId) return;

    const statusRef = ref(rtDb, `status/${chatPartnerId}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        setPartnerStatus("离线");
        return;
      }

      if (val.state === "online") {
        setPartnerStatus("在线");
      } else if (val.lastSeen) {
        setPartnerStatus(formatLastSeen(val.lastSeen));
      } else {
        setPartnerStatus("离线");
      }
    });

    return () => unsubscribe();
  }, [chatPartnerId]);

  return (
    <div className="p-4 border-b">
      <p className="text-sm text-gray-600">
        {partnerStatus}
      </p>
    </div>
  );
}

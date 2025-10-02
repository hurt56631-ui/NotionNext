import { ref, onDisconnect, set, serverTimestamp } from "firebase/database";
import { rtDb } from "./firebase";

/**
 * 设置用户在线状态
 * @param {Object} user - Firebase 用户对象
 */
export const setupPresence = (user) => {
  if (!user || !user.uid) return;

  const statusRef = ref(rtDb, `status/${user.uid}`);

  // 在线状态数据
  const onlineStatus = {
    state: "online",
    lastSeen: serverTimestamp(),
  };

  // 离线状态数据
  const offlineStatus = {
    state: "offline",
    lastSeen: serverTimestamp(),
  };

  // 用户断开连接时写入离线
  onDisconnect(statusRef).set(offlineStatus);

  // 登录时立即写入在线
  set(statusRef, onlineStatus);
};

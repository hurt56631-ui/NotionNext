// 在 ChatInterface.js 文件中，找到 sendMessage 函数并完全替换成下面的代码

const sendMessage = async (textToSend) => {
    console.group("🚀 [sendMessage - 终极简化版] 开始执行");

    const content = (textToSend || input).trim();
    
    // --- 日志点 1: 检查所有前提条件 ---
    console.log("1. 检查前提条件...");
    console.log(`  - 消息内容 (content): "${content}"`);
    console.log("  - 当前用户 (currentUser):", currentUser);
    console.log("  - 当前用户的UID (user?.uid):", user?.uid);
    console.log("  - 对方用户 (peerUser):", peerUser);
    console.log("  - 对方用户的ID (peerUser?.id):", peerUser?.id);
    console.log(`  - 聊天ID (chatId): "${chatId}"`);

    if (!content || !user?.uid || !peerUser?.id || !chatId) {
      console.error("❌ [sendMessage] 失败：前提条件不满足！函数提前退出。");
      console.groupEnd();
      alert("发送失败：缺少关键信息（用户、聊天对象或内容）。");
      return;
    }
    
    console.log("✅ 1. 前提条件满足。");
    setSending(true);

    try {
      // --- 步骤 1: 强制创建或更新聊天室文档 ---
      const chatDocRef = doc(db, "privateChats", chatId);
      const chatData = {
          members: [user.uid, peerUser.id],
          lastMessage: content,
          lastMessageAt: serverTimestamp(),
          [`unreadCounts.${peerUser.id}`]: increment(1),
          [`unreadCounts.${user.uid}`]: 0
      };
      console.log("2. 准备创建/合并聊天室文档 (setDoc with merge)...");
      console.log("   - 文档路径:", chatDocRef.path);
      console.log("   - 将要写入的数据:", chatData);

      await setDoc(chatDocRef, chatData, { merge: true });

      console.log("✅ 2. 聊天室文档操作成功！");

      // --- 步骤 2: 单独创建消息文档 ---
      const messagesColRef = collection(db, "privateChats", chatId, "messages");
      const messageData = {
        text: content,
        senderId: user.uid,
        createdAt: serverTimestamp()
      };
      console.log("3. 准备创建消息文档 (addDoc)...");
      console.log("   - 集合路径:", messagesColRef.path);
      console.log("   - 将要写入的数据:", messageData);
      
      await addDoc(messagesColRef, messageData);

      console.log("✅ 3. 消息文档创建成功！");
      
      setInput("");
      setMyTranslationResult(null);

    } catch (error) {
      // --- 步骤 3: 捕获并详细记录错误 ---
      console.error("❌ [sendMessage] 失败：在执行操作时捕获到错误！");
      console.error("  - 错误代码 (error.code):", error.code);
      console.error("  - 错误信息 (error.message):", error.message);
      console.error("  - 完整错误对象 (error):", error);
      alert(`发送失败，请检查浏览器控制台获取详细错误信息。\n错误: ${error.message}`);
    } finally {
      setSending(false);
      console.log("🏁 [sendMessage] 执行完毕。");
      console.groupEnd();
    }
  };

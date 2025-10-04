// In your PrivateChat component's sendMessage function...
const chatRef = doc(db, 'privateChats', chatId);
const otherUserId = //... get the other user's ID

// Use a batch write to update multiple things at once
const batch = writeBatch(db);

// 1. Add the new message
const messageRef = doc(collection(db, `privateChats/${chatId}/messages`));
batch.set(messageRef, { /* ... message data ... */ });

// 2. Update the unread count for the receiver
batch.update(chatRef, {
  lastMessage: "...",
  lastMessageAt: serverTimestamp(),
  [`unreadCounts.${otherUserId}`]: increment(1) // Increment the count for the other user
});

await batch.commit();

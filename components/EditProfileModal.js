// components/EditProfileModal.js

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, updateUserProfile, uploadImage } from '@/lib/user'; // 假设您的 API 函数在这里

const EditProfileModal = ({ onClose, onProfileUpdate }) => {
  const { user: currentUser } = useAuth();
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    gender: 'not_specified',
    nationality: '',
    city: '',
    tags: []
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // 用于图片上传的状态
  const [photoFile, setPhotoFile] = useState(null);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [backgroundPreview, setBackgroundPreview] = useState('');

  // 使用 Ref 来触发隐藏的文件输入框
  const photoInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  // 在组件加载时获取当前用户的最新资料
  useEffect(() => {
    if (currentUser) {
      const fetchProfile = async () => {
        setLoading(true);
        try {
          const currentProfile = await getUserProfile(currentUser.uid);
          if (currentProfile) {
            setProfileData({
              displayName: currentProfile.displayName || '',
              bio: currentProfile.bio || '',
              gender: currentProfile.gender || 'not_specified',
              nationality: currentProfile.nationality || '',
              city: currentProfile.city || '',
              tags: currentProfile.tags || []
            });
            setPhotoPreview(currentProfile.photoURL || '');
            setBackgroundPreview(currentProfile.backgroundImageUrl || '');
          }
        } catch (error) {
          console.error("无法获取个人资料:", error);
          alert("无法获取个人资料，请稍后重试。");
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    }
  }, [currentUser]);

  // 处理文本输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  // 处理标签输入（以逗号分隔）
  const handleTagsChange = (e) => {
    const tags = e.target.value.split(/[,，\s]+/).filter(Boolean); // 按中英文逗号或空格分割
    setProfileData(prev => ({ ...prev, tags }));
  };
  
  // 处理文件选择
  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      if (type === 'photo') {
        setPhotoFile(file);
        setPhotoPreview(previewUrl);
      } else if (type === 'background') {
        setBackgroundFile(file);
        setBackgroundPreview(previewUrl);
      }
    }
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setProcessing(true);

    try {
      const updates = { ...profileData };

      // 1. 上传新头像 (如果已选择)
      if (photoFile) {
        // 路径: /profile_images/{userId}/avatar.jpg
        const photoURL = await uploadImage(photoFile, `profile_images/${currentUser.uid}/avatar`);
        updates.photoURL = photoURL;
      }

      // 2. 上传新背景图 (如果已选择)
      if (backgroundFile) {
        const backgroundImageUrl = await uploadImage(backgroundFile, `profile_images/${currentUser.uid}/background`);
        updates.backgroundImageUrl = backgroundImageUrl;
      }
      
      // 3. 更新 Firestore 中的用户资料
      await updateUserProfile(currentUser.uid, updates);

      alert('个人资料更新成功！');
      onProfileUpdate(); // 通知父组件刷新
      onClose(); // 关闭弹窗

    } catch (error) {
      console.error("更新失败:", error);
      alert(`更新失败: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">编辑个人资料</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">正在加载资料...</div>
          ) : (
            <div className="p-6 space-y-6">
              {/* 图片上传 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">形象设置</label>
                <div className="flex items-center gap-4">
                  {/* 头像 */}
                  <div className="text-center">
                    <img src={photoPreview || 'https://www.gravatar.com/avatar?d=mp'} alt="头像预览" className="w-20 h-20 rounded-full object-cover mx-auto mb-2 border dark:border-gray-600"/>
                    <button type="button" onClick={() => photoInputRef.current.click()} className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">更换头像</button>
                    <input type="file" ref={photoInputRef} onChange={(e) => handleFileChange(e, 'photo')} accept="image/*" className="hidden"/>
                  </div>
                  {/* 背景 */}
                  <div className="text-center flex-1">
                     <div 
                        className="w-full h-20 rounded-lg bg-cover bg-center mb-2 border dark:border-gray-600" 
                        style={{backgroundImage: `url(${backgroundPreview || '/images/zhuyetu.jpg'})`}}
                     ></div>
                    <button type="button" onClick={() => backgroundInputRef.current.click()} className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">更换背景</button>
                    <input type="file" ref={backgroundInputRef} onChange={(e) => handleFileChange(e, 'background')} accept="image/*" className="hidden"/>
                  </div>
                </div>
              </div>

              {/* 昵称 */}
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">昵称</label>
                <input type="text" name="displayName" id="displayName" value={profileData.displayName} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>

              {/* 个人简介 */}
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">个人简介</label>
                <textarea name="bio" id="bio" rows="3" value={profileData.bio} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="这位用户很神秘..."></textarea>
              </div>

              {/* 其他信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300">性别</label>
                  <select name="gender" id="gender" value={profileData.gender} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                    <option value="not_specified">不设置</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="nationality" className="block text-sm font-medium text-gray-700 dark:text-gray-300">国家/地区</label>
                  <input type="text" name="nationality" id="nationality" value={profileData.nationality} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300">城市</label>
                  <input type="text" name="city" id="city" value={profileData.city} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                 <div>
                  <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">个人标签</label>
                  <input type="text" name="tags" id="tags" value={profileData.tags.join(', ')} onChange={handleTagsChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="用逗号分隔，如：学生, 编程"/>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 dark:border-t dark:border-gray-700 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
              取消
            </button>
            <button type="submit" disabled={processing || loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {processing ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;

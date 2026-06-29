import { 
  ref, uploadBytesResumable, getDownloadURL, deleteObject 
} from 'firebase/storage';
import { 
  collection, addDoc, serverTimestamp, deleteDoc, doc 
} from 'firebase/firestore';
import { db, storage, auth, handleFirestoreError, OperationType } from '../firebase';
import { MediaItem } from '../types';
import { isAbortError } from '../utils';

export const mediaService = {
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<MediaItem> {
    console.log('Starting upload for:', file.name, file.size, file.type);
    
    if (!auth.currentUser) {
      console.error('Upload failed: User not authenticated');
      throw new Error('User must be authenticated to upload files');
    }

    const fileId = Math.random().toString(36).substring(7);
    const uploadKey = `${fileId}_${file.name}`;
    const storageRef = ref(storage, `media/${uploadKey}`);
    
    console.log('Storage ref created:', storageRef.fullPath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      // Set a safety timeout
      const timeoutId = setTimeout(() => {
        console.error('Upload timed out for:', file.name);
        uploadTask.cancel();
        reject(new Error('上传超时：文件上传超过 120 秒，请检查网络连接或尝试更小的文件。'));
      }, 120000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload progress for ${file.name}: ${progress.toFixed(2)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes})`);
          if (onProgress) onProgress(progress);
        },
        (error) => {
          clearTimeout(timeoutId);
          if (!isAbortError(error)) {
            console.error('Storage upload error details:', {
              code: error.code,
              message: error.message,
              name: error.name,
              serverResponse: (error as any).serverResponse
            });
            
            if (error.code === 'storage/unauthorized') {
              reject(new Error('权限不足：请确保您的 Firebase Storage 规则已正确配置，允许已登录用户上传。'));
            } else {
              reject(error);
            }
          } else {
            reject(error);
          }
        },
        async () => {
          clearTimeout(timeoutId);
          console.log('Storage upload completed, getting download URL...');
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Download URL obtained:', downloadURL);
            
            const mediaData = {
              url: downloadURL,
              name: file.name,
              type: file.type.startsWith('video') ? 'video' : 'image',
              size: file.size,
              mimeType: file.type,
              altText: '',
              createdAt: serverTimestamp()
            };
            
            console.log('Adding document to Firestore...');
            try {
              const docRef = await addDoc(collection(db, 'media'), mediaData);
              console.log('Firestore document added with ID:', docRef.id);
              
              resolve({
                id: docRef.id,
                url: downloadURL,
                name: file.name,
                type: mediaData.type as 'image' | 'video',
                size: file.size,
                mimeType: file.type,
                altText: '',
                createdAt: new Date()
              });
            } catch (fsError) {
              if (!isAbortError(fsError)) {
                console.error('Firestore addDoc error:', fsError);
              }
              handleFirestoreError(fsError, OperationType.WRITE, 'media');
              reject(fsError);
            }
          } catch (error) {
            if (!isAbortError(error)) {
              console.error('Error in completion handler:', error);
            }
            reject(error);
          }
        }
      );
    });
  },

  async deleteMedia(item: MediaItem) {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'media', item.id));
      
      // Delete from Storage (if it's a firebase storage URL)
      if (item.url.includes('firebasestorage.googleapis.com')) {
        const storageRef = ref(storage, item.url);
        await deleteObject(storageRef);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error deleting media:', error);
      throw error;
    }
  }
};

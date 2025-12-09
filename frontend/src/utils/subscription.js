// Utility functions for managing user-specific subscription status
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Get subscription status for the current user from Firebase
 */
export const getUserSubscriptionStatus = async (userId) => {
  if (!userId) return false;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.hasSubscription === true;
    }
    return false;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return false;
  }
};

/**
 * Set subscription status for a user in Firebase
 */
export const setUserSubscriptionStatus = async (userId, hasSubscription) => {
  if (!userId) return;
  
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      await updateDoc(userRef, {
        hasSubscription: hasSubscription === true,
        subscriptionUpdatedAt: new Date()
      });
    } else {
      await setDoc(userRef, {
        hasSubscription: hasSubscription === true,
        subscriptionUpdatedAt: new Date()
      });
    }
    
    // Also update localStorage for quick access (keyed by user ID)
    if (auth.currentUser) {
      localStorage.setItem(`cc_has_subscription_${userId}`, hasSubscription ? 'true' : 'false');
    }
  } catch (error) {
    console.error('Error setting subscription status:', error);
  }
};

/**
 * Check if current user has subscription (checks Firebase and localStorage)
 */
export const hasSubscription = async () => {
  const user = auth.currentUser;
  if (!user) return false;
  
  // Check localStorage first (faster)
  const cached = localStorage.getItem(`cc_has_subscription_${user.uid}`);
  if (cached === 'true') {
    // Verify with Firebase
    const firebaseStatus = await getUserSubscriptionStatus(user.uid);
    if (!firebaseStatus) {
      // Clear cache if Firebase says no subscription
      localStorage.removeItem(`cc_has_subscription_${user.uid}`);
    }
    return firebaseStatus;
  }
  
  // Check Firebase
  return await getUserSubscriptionStatus(user.uid);
};

/**
 * Clear subscription status when user logs out
 */
export const clearSubscriptionStatus = () => {
  const user = auth.currentUser;
  if (user) {
    localStorage.removeItem(`cc_has_subscription_${user.uid}`);
  }
  // Also clear old global key for backward compatibility
  localStorage.removeItem('cc_has_subscription');
};

/**
 * Initialize subscription status listener
 */
export const initSubscriptionListener = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Load subscription status when user logs in
      const status = await getUserSubscriptionStatus(user.uid);
      if (status) {
        localStorage.setItem(`cc_has_subscription_${user.uid}`, 'true');
      } else {
        localStorage.removeItem(`cc_has_subscription_${user.uid}`);
      }
      if (callback) callback(status);
    } else {
      // Clear subscription status when user logs out
      clearSubscriptionStatus();
      if (callback) callback(false);
    }
  });
};

